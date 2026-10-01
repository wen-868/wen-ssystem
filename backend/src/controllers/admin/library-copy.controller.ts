import { z } from "zod";
import { ok, fail } from "../../shared/response";
import * as service from "../../services/admin/library-copy.service";

/**
 * R101-C6-4-1：租户侧「商品库调取（COPY）」控制器（4 条端点，路径由派单卡与立项草案逐字钉死）
 *
 *   · GET  /api/admin/library/spus       → 调取前检索（分页，只返回 APPROVED，每行带 copied/copiedSpuId）
 *   · GET  /api/admin/library/spus/:id   → 调取前预览（SPU + skus + copied/copiedSpuId + quota{used,limit,remaining}）
 *   · POST /api/admin/library/copies     → 执行调取（含批量；CREATED/SKIPPED/REJECTED）
 *   · GET  /api/admin/library/copies     → 我的调取记录（可见范围 = 当前令牌租户）
 *
 * 鉴权/授权分工：认证与租户隔离由路由的 requireAuthWithTenant 负责，权限点由路由的 requirePermission 负责
 *   （library:view 三条只读 + library:copy 一条写），本控制器不重复判权限。
 *
 * 错误口径（立项草案 §4.2 状态码表 + 裁定 Q3）：
 *   · 参数错误（pageSize > 50 / 空数组 / 超 50 条）⇒ zod 抛错 ⇒ errorHandler 统一 400
 *   · SPU 不存在或非 APPROVED ⇒ service 抛 AppError(404)
 *   · 商品配额不足 ⇒ 400 + 业务码 "1001"（与既有 storage-guard 的 1002 同形；**不能**走 AppError，
 *     因为 errorHandler 会把 code 归一成 HTTP 状态码字符串 400）
 *   · 部分成功（批量里有 CREATED/SKIPPED/REJECTED 混合）⇒ 200，逐条结果 + summary，逐条给原因
 */

const listQuerySchema = z.object({
  keyword: z.string().trim().min(1, "关键词不能为空").optional(),
  barcode: z.string().trim().min(1, "条码不能为空").optional(),
  brandId: z.coerce.number().int().positive("品牌ID须为正整数").optional(),
  page: z.coerce.number().int().min(1, "页码最小为 1").default(1),
  pageSize: z.coerce.number().int().min(1, "每页条数最小为 1").max(50, "每页最多 50 条").default(20),
});

const logQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "页码最小为 1").default(1),
  pageSize: z.coerce.number().int().min(1, "每页条数最小为 1").max(50, "每页最多 50 条").default(20),
});

const idParamSchema = z.coerce.number().int().positive("商品库SPU ID须为正整数");

/** 请求体契约（逐字对齐立项草案 §4.2 T3）：librarySpuIds 1..50；skuSelection 可选，键为 SPU id，值为 SKU id 数组 */
const copyBodySchema = z.object({
  librarySpuIds: z
    .array(z.coerce.number().int().positive("商品库SPU ID须为正整数"))
    .min(1, "至少选择 1 个商品")
    .max(50, "单次最多调取 50 个商品"),
  skuSelection: z.record(z.string(), z.array(z.coerce.number().int().positive())).optional(),
});

/** GET /api/admin/library/spus —— 调取前检索（权限点 library:view） */
export async function listLibrarySpus(req: any, res: any) {
  const query = listQuerySchema.parse(req.query ?? {});
  const result = await service.listLibrarySpus({
    tenantId: String(req.tenantId),
    keyword: query.keyword,
    barcode: query.barcode,
    brandId: query.brandId,
    page: query.page,
    pageSize: query.pageSize,
  });
  res.json(ok(result));
}

/** GET /api/admin/library/spus/:id —— 调取前预览（权限点 library:view） */
export async function getLibrarySpu(req: any, res: any) {
  const id = idParamSchema.parse(req.params.id);
  res.json(ok(await service.getLibrarySpuPreview(id, String(req.tenantId))));
}

/** POST /api/admin/library/copies —— 执行调取（权限点 library:copy） */
export async function copyLibrarySpus(req: any, res: any) {
  const body = copyBodySchema.parse(req.body ?? {});
  const result = await service.copyLibrarySpus({
    tenantId: String(req.tenantId),
    operatorId: req.user?.id ?? null,
    operatorName: req.user?.realName || req.user?.username || null,
    librarySpuIds: body.librarySpuIds,
    skuSelection: body.skuSelection,
  });

  // 全部被拒且原因只有配额一条 ⇒ 显式业务码 1001（Q3 裁定：配额不足 400 + 1001，不落 200 混在 items 里）
  const quotaRejected =
    result.summary.created === 0 &&
    result.summary.skipped === 0 &&
    result.items.length > 0 &&
    result.items.every((item) => item.result === "REJECTED" && (item.reason ?? "").includes("商品配额不足"));
  if (quotaRejected) {
    res.status(400).json(fail(`商品配额不足，本次调取被拒绝：${result.items[0].reason}，请升级套餐或清理已有商品后重试`, "1001"));
    return;
  }

  res.json(ok(result));
}

/** GET /api/admin/library/copies —— 我的调取记录（权限点 library:view，可见范围 = 当前令牌租户） */
export async function listMyCallLogs(req: any, res: any) {
  const query = logQuerySchema.parse(req.query ?? {});
  const result = await service.listMyCallLogs({
    tenantId: String(req.tenantId),
    page: query.page,
    pageSize: query.pageSize,
  });
  res.json(ok(result));
}
