import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/platform/platform-promo-code.service";

/**
 * R101-C6-3-2a：平台渠道推广码控制器（**4 条端点**，路径由派单卡 §四 钉死，不得自拟）
 *
 * 依据：docs/tasks/cards/R101-派单-20260929-C6-3-2a.md §四
 *   · GET  /api/platform/promo-codes                  → { items, total, page, pageSize }（分页 + 关键词 + 状态）
 *   · POST /api/platform/promo-codes                  → { id, promoCode }（PC + 8 位去易混；冲突重试 5 次后 409）
 *   · POST /api/platform/promo-codes/:id/disable      → 停用（未知 id ⇒ 404；已停用 ⇒ 幂等 200 + 说明）
 *   · GET  /api/platform/promo-codes/:code/attributions → 该码的归因列表（只读聚合；未知码值 ⇒ 404）
 *
 * 校验口径：zod 解析失败 ⇒ ZodError ⇒ errorHandler 统一转 400；
 *   业务错误（404 / 409 / 400）由 service 抛 AppError。本控制器**不吞错**、不做 try/catch。
 * 归因写入（开租户 / 订阅审核通过）**不在本文件**：那是服务层内部调用，无对外端点（卡 §四）。
 * 零涉钱（红线①）：本控制器只透传码档案字段，不认识任何金额/积分/佣金字段。
 */

const promoCodeIdSchema = z.coerce
  .number({ invalid_type_error: "推广码 ID 须为数字" })
  .int("推广码 ID 须为整数")
  .positive("推广码 ID 须为正整数");

const promoCodeValueSchema = z
  .string({ required_error: "缺少推广码" })
  .trim()
  .min(1, "推广码不能为空")
  .max(32, "推广码最长 32 字符");

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "页码最小为 1").default(1),
  pageSize: z.coerce.number().int().min(1).max(100, "每页最多 100 条").default(20),
  keyword: z.string().trim().max(64, "关键词最长 64 字符").optional(),
  status: z.enum(["ACTIVE", "DISABLED"], {
    invalid_type_error: "status 须为 ACTIVE/DISABLED 之一",
  }).optional(),
});

/**
 * POST body（卡 §四逐字字段集：channelType/channelName/expireAt?/remark?）
 * `owner_admin_id` **不在请求体里**（卡面没有该字段）：由服务层取当前平台管理员身份写入，
 * 避免"渠道负责人"被调用方任意伪造。
 */
const createBodySchema = z
  .object({
    channelType: z
      .string({ required_error: "缺少渠道类型" })
      .trim()
      .min(1, "渠道类型不能为空")
      .max(32, "渠道类型最长 32 字符"),
    channelName: z
      .string({ required_error: "缺少渠道名称" })
      .trim()
      .min(1, "渠道名称不能为空")
      .max(64, "渠道名称最长 64 字符"),
    expireAt: z
      .union([z.string(), z.date()], { invalid_type_error: "有效期须为日期字符串或日期对象" })
      .nullable()
      .optional(),
    remark: z
      .string({ invalid_type_error: "备注须为字符串或 null" })
      .trim()
      .max(255, "备注最长 255 字符")
      .nullable()
      .optional(),
  })
  .strict();

/** 当前平台管理员 ID（requirePlatformAuth 注入 req.user）；拿不到身份 ⇒ NULL，不编造 ID */
function currentAdminId(req: any): number | null {
  const adminId = Number(req?.user?.id ?? 0);
  return Number.isFinite(adminId) && adminId > 0 ? adminId : null;
}

/** GET /api/platform/promo-codes —— 分页 + 关键词 + 状态（空表 ⇒ items: []、total 0） */
export async function listPromoCodes(req: any, res: any) {
  const query = listQuerySchema.parse(req.query ?? {});
  res.json(ok(await service.listPromoCodes(query)));
}

/** POST /api/platform/promo-codes —— 生成推广码（返回 { id, promoCode }） */
export async function createPromoCode(req: any, res: any) {
  const body = createBodySchema.parse(req.body ?? {});
  res.json(ok(await service.createPromoCode(body, currentAdminId(req))));
}

/** POST /api/platform/promo-codes/:id/disable —— 停用（已停用 ⇒ 幂等 200 + 说明） */
export async function disablePromoCode(req: any, res: any) {
  const id = promoCodeIdSchema.parse(req.params.id);
  res.json(ok(await service.disablePromoCode(id)));
}

/** GET /api/platform/promo-codes/:code/attributions —— 该码的归因列表（只读） */
export async function listAttributionsByCode(req: any, res: any) {
  const code = promoCodeValueSchema.parse(req.params.code);
  res.json(ok(await service.listAttributionsByCode(code)));
}

