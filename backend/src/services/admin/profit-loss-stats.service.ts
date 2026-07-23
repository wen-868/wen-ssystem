import { queryOneWithTenant, queryWithTenant } from "../../shared/db";

/** 报损统计行（COUNT/SUM 聚合，用于算术运算故用 number） */
interface LossStatsRow {
  lossOrderCount: number;
  lossTotalQty: number;
  lossTotalAmount: number;
}

/** 报溢统计行（COUNT/SUM 聚合，用于算术运算故用 number） */
interface ProfitStatsRow {
  profitOrderCount: number;
  profitTotalQty: number;
  profitTotalAmount: number;
}

/** COUNT(*) AS count 结果行 */
interface CountCntRow {
  count: number;
}

/** 报损按类型统计行 */
interface LossByTypeRow {
  lossType: string;
  orderCount: number;
  totalQty: number;
  totalAmount: number;
}

/** 报溢按类型统计行 */
interface ProfitByTypeRow {
  profitType: string;
  orderCount: number;
  totalQty: number;
  totalAmount: number;
}

// ========== 损益统计 ==========
export async function getProfitLossStats(params: {
  tenantId: string;
  dateStart?: string;
  dateEnd?: string;
  storeId?: number;
}) {
  const { tenantId, dateStart, dateEnd, storeId } = params;
  const lossConditions: string[] = ["tenant_id = ?"];
  const profitConditions: string[] = ["tenant_id = ?"];
  const lossParams: unknown[] = [tenantId];
  const profitParams: unknown[] = [tenantId];

  if (storeId !== undefined) {
    lossConditions.push("store_id = ?");
    profitConditions.push("store_id = ?");
    lossParams.push(storeId);
    profitParams.push(storeId);
  }
  if (dateStart) {
    lossConditions.push("DATE(created_at) >= ?");
    profitConditions.push("DATE(created_at) >= ?");
    lossParams.push(dateStart);
    profitParams.push(dateStart);
  }
  if (dateEnd) {
    lossConditions.push("DATE(created_at) <= ?");
    profitConditions.push("DATE(created_at) <= ?");
    lossParams.push(dateEnd);
    profitParams.push(dateEnd);
  }

  // 已审核的才统计
  lossConditions.push("status = 'APPROVED'");
  profitConditions.push("status = 'APPROVED'");

  const lossWhere = `WHERE ${lossConditions.join(" AND ")}`;
  const profitWhere = `WHERE ${profitConditions.join(" AND ")}`;

  // 报损统计
  const lossStats = await queryOneWithTenant<LossStatsRow>(
    `SELECT
       COUNT(*) AS lossOrderCount,
       COALESCE(SUM(total_qty), 0) AS lossTotalQty,
       COALESCE(SUM(total_amount), 0) AS lossTotalAmount
     FROM t_inventory_loss_order
     ${lossWhere}`,
    lossParams,
    tenantId
  );

  // 报溢统计
  const profitStats = await queryOneWithTenant<ProfitStatsRow>(
    `SELECT
       COUNT(*) AS profitOrderCount,
       COALESCE(SUM(total_qty), 0) AS profitTotalQty,
       COALESCE(SUM(total_amount), 0) AS profitTotalAmount
     FROM t_inventory_profit_order
     ${profitWhere}`,
    profitParams,
    tenantId
  );

  // 待审核数量
  const pendingLoss = await queryOneWithTenant<CountCntRow>(
    `SELECT COUNT(*) AS count FROM t_inventory_loss_order WHERE tenant_id = ? AND status = 'PENDING'`,
    [tenantId],
    tenantId
  );
  const pendingProfit = await queryOneWithTenant<CountCntRow>(
    `SELECT COUNT(*) AS count FROM t_inventory_profit_order WHERE tenant_id = ? AND status = 'PENDING'`,
    [tenantId],
    tenantId
  );

  // 按类型统计报损
  const lossByType = await queryWithTenant<LossByTypeRow>(
    `SELECT loss_type AS lossType, COUNT(*) AS orderCount,
            COALESCE(SUM(total_qty), 0) AS totalQty,
            COALESCE(SUM(total_amount), 0) AS totalAmount
     FROM t_inventory_loss_order
     ${lossWhere}
     GROUP BY loss_type
     ORDER BY totalAmount DESC`,
    lossParams,
    tenantId
  );

  // 按类型统计报溢
  const profitByType = await queryWithTenant<ProfitByTypeRow>(
    `SELECT profit_type AS profitType, COUNT(*) AS orderCount,
            COALESCE(SUM(total_qty), 0) AS totalQty,
            COALESCE(SUM(total_amount), 0) AS totalAmount
     FROM t_inventory_profit_order
     ${profitWhere}
     GROUP BY profit_type
     ORDER BY totalAmount DESC`,
    profitParams,
    tenantId
  );

  // 净损益
  const netAmount = (profitStats?.profitTotalAmount ?? 0) - (lossStats?.lossTotalAmount ?? 0);
  const netQty = (profitStats?.profitTotalQty ?? 0) - (lossStats?.lossTotalQty ?? 0);

  return {
    lossOrderCount: lossStats?.lossOrderCount ?? 0,
    lossTotalQty: lossStats?.lossTotalQty ?? 0,
    lossTotalAmount: lossStats?.lossTotalAmount ?? 0,
    profitOrderCount: profitStats?.profitOrderCount ?? 0,
    profitTotalQty: profitStats?.profitTotalQty ?? 0,
    profitTotalAmount: profitStats?.profitTotalAmount ?? 0,
    pendingLossCount: pendingLoss?.count ?? 0,
    pendingProfitCount: pendingProfit?.count ?? 0,
    netAmount,
    netQty,
    lossByType,
    profitByType,
  };
}
