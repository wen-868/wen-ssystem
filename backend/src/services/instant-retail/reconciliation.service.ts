import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

// ==================== 类型定义 ====================

/** 对账统计汇总行 */
interface ReconciliationSummaryRow {
  orderCount: number | string;
  totalSales: number | string;
  completedAmount: number | string;
  totalDeliveryFee: number | string;
}

/** 计数 cnt 行 */
interface CountCntRow {
  cnt: number;
}

/** 平台订单全字段行 */
interface PlatformOrderRow {
  id: number;
  platform_order_id: string;
  platform: string;
  store_id: number | null;
  status: string;
  order_data_json: string | null;
  tenant_id: string;
  created_at: string | Date;
  updated_at: string | Date;
}

export async function getReconciliationSummary(params: {
  tenantId: string; storeId?: number; platform?: string;
  startDate?: string; endDate?: string;
}) {
  const { tenantId, storeId, platform, startDate, endDate } = params;
  const conditions = ["ro.tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (storeId) { conditions.push("ro.store_id = ?"); values.push(storeId); }
  if (platform) { conditions.push("ro.platform = ?"); values.push(platform); }
  if (startDate) { conditions.push("ro.created_at >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("ro.created_at <= ?"); values.push(endDate); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const stats = await queryOneWithTenant<ReconciliationSummaryRow>(
    `SELECT
       COUNT(*) AS orderCount,
       COALESCE(SUM(ro.pay_amount), 0) AS totalSales,
       COALESCE(SUM(CASE WHEN ro.order_status IN ('COMPLETED') THEN ro.pay_amount ELSE 0 END), 0) AS completedAmount,
       COALESCE(SUM(ro.delivery_fee), 0) AS totalDeliveryFee
     FROM t_retail_order ro ${where}`,
    values, tenantId
  );
  return {
    orderCount: Number(stats?.orderCount ?? 0),
    totalSales: Number(stats?.totalSales ?? 0),
    completedAmount: Number(stats?.completedAmount ?? 0),
    totalDeliveryFee: Number(stats?.totalDeliveryFee ?? 0),
    platformCommission: 0,
    platformAmount: 0,
    diffAmount: 0,
    reconciliationStatus: "pending",
  };
}

export async function listReconciliationRecords(params: {
  tenantId: string; storeId?: number; platform?: string;
  startDate?: string; endDate?: string; page?: number; pageSize?: number;
}) {
  const { tenantId, storeId, platform, startDate, endDate, page = 1, pageSize = 20 } = params;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (storeId) { conditions.push("store_id = ?"); values.push(storeId); }
  if (platform) { conditions.push("platform = ?"); values.push(platform); }
  if (startDate) { conditions.push("created_at >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("created_at <= ?"); values.push(endDate); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = await queryOneWithTenant<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_platform_order ${where}`, values, tenantId);
  const rows = await queryWithTenant<PlatformOrderRow>(
    `SELECT * FROM t_platform_order ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize], tenantId
  );
  return { list: rows, total: Number(total?.cnt ?? 0), page, pageSize };
}