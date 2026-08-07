import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as settlementService from "../../services/admin/platform-settlement.service";

/**
 * R97-01: 平台财务结算（saas-admin 财务结算页）
 *
 * 数据源为平台级结算表 t_platform_settlement（平台视角，全租户），
 * 返回结构对齐 saas-admin/src/views/Reconciliation.vue 期望：
 * - 列表行：reconciliationNo / tenantName / period / orderAmount / settleAmount / status / createdAt
 * - stats：monthlyRevenue / pendingAmount / settledAmount / totalCount
 * - 详情：同上 + items（订单明细，settlement 无明细表，返回空数组）
 */

interface SettlementRow {
  id: number;
  settlementNo: string;
  tenantName: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  settledAmount: number;
  status: string;
  createdAt: string;
}

function toReconciliationRow(s: SettlementRow) {
  const period =
    s.periodStart && s.periodEnd
      ? `${String(s.periodStart).slice(0, 10)} ~ ${String(s.periodEnd).slice(0, 10)}`
      : (s.periodStart || s.periodEnd || "");
  return {
    id: s.id,
    reconciliationNo: s.settlementNo,
    tenantName: s.tenantName || "",
    period,
    orderAmount: Number(s.totalAmount ?? 0),
    // t_platform_settlement 无佣金字段，前端展示 0.00
    settleAmount: Number(s.settledAmount ?? 0),
    status: s.status,
    createdAt: s.createdAt,
  };
}

/** GET /api/platform/reconciliation - 财务结算列表（分页+筛选） */
export const listPlatformReconciliations = asyncHandler(async (req, res) => {
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    keyword: z.string().optional(),
    status: z.string().optional(),
  }).parse(req.query);

  const result = await settlementService.listSettlements({
    page: params.page,
    pageSize: params.pageSize,
    status: params.status || undefined,
    tenantName: params.keyword || undefined,
  });
  const records = (result.records as unknown as SettlementRow[]).map(toReconciliationRow);

  res.json(ok({
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    records,
  }));
});

/** GET /api/platform/reconciliation/:id - 财务结算详情 */
export const getPlatformReconciliationDetail = asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const record = await settlementService.getSettlementById(id);
  res.json(ok({
    ...(record ? toReconciliationRow(record as unknown as SettlementRow) : {}),
    orderCount: undefined,
    commissionRate: undefined,
    items: [],
  }));
});

/** GET /api/platform/reconciliation/stats - 财务结算统计 */
export const getPlatformReconciliationStats = asyncHandler(async (_req, res) => {
  const stats = await settlementService.getSettlementStats();
  res.json(ok({
    monthlyRevenue: Number(stats.currentMonthRevenue ?? 0),
    pendingAmount: Number(stats.pendingSettlement ?? 0),
    settledAmount: Number(stats.settledAmount ?? 0),
    totalCount: Number(stats.settlementCount ?? 0),
  }));
});

/** PUT /api/platform/reconciliation/:id/settle - 结算确认（置为 SETTLED） */
export const settlePlatformReconciliation = asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await settlementService.updateSettlementStatus(id, "SETTLED");
  res.json(ok(result));
});
