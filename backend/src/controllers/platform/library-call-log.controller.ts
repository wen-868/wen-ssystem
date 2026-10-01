import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/platform/library-call-log.service";

/**
 * R101-C6-4-1：平台侧「商品库调取统计」控制器（4 条端点，路径逐字对齐立项草案 §4.3 P1~P4）
 *
 *   · GET /api/platform/library/call-logs      → 调取流水明细（传 librarySpuId 即"某商品被哪些租户调取"）
 *   · GET /api/platform/library/stats          → KPI 汇总（本月调取次数 + 排行 + unavailable[]）
 *   · GET /api/platform/library/stats/rank     → 本月租户调取排行 Top10
 *   · GET /api/platform/library/stats/trend    → 近 N 天日调取次数
 *
 * P5 /api/platform/library/stats/category-dist **不注册**（Q9 裁定本期不实现）：无类目载体，
 *   前端若调用该路径应得 404，而不是后端返回"未分类单值"造的假图；无载体的事实由 stats.unavailable[] 显式给出。
 *
 * 认证由 platform-library.routes.ts 的 router 级 requirePlatformAuth 负责（本控制器不重复判权限）。
 */

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期须为 YYYY-MM-DD 格式");

const logQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "页码最小为 1").default(1),
  pageSize: z.coerce.number().int().min(1, "每页条数最小为 1").max(100, "每页最多 100 条").default(20),
  tenantId: z.string().trim().min(1, "租户ID不能为空").optional(),
  librarySpuId: z.coerce.number().int().positive("商品库SPU ID须为正整数").optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
});

const trendQuerySchema = z.object({
  days: z.coerce.number().int().min(1, "天数最小为 1").max(90, "天数最多 90").default(30),
});

/** GET /api/platform/library/call-logs —— 调取流水明细（空集 ⇒ records: []，不返回 500） */
export async function listCallLogs(req: any, res: any) {
  const query = logQuerySchema.parse(req.query ?? {});
  res.json(
    ok(
      await service.listCallLogs({
        page: query.page,
        pageSize: query.pageSize,
        tenantId: query.tenantId,
        librarySpuId: query.librarySpuId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      })
    )
  );
}

/** GET /api/platform/library/stats —— KPI 汇总（无载体的维度进 unavailable[]） */
export async function getCallStats(_req: any, res: any) {
  res.json(ok(await service.getCallStats()));
}

/** GET /api/platform/library/stats/rank —— 本月租户调取排行 Top10 */
export async function getTenantRank(_req: any, res: any) {
  res.json(ok(await service.getTenantRank()));
}

/** GET /api/platform/library/stats/trend —— 近 N 天日调取次数（无数据 ⇒ items: []） */
export async function getCallTrend(req: any, res: any) {
  const query = trendQuerySchema.parse(req.query ?? {});
  res.json(ok(await service.getCallTrend(query.days)));
}
