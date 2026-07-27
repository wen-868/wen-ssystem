﻿﻿﻿﻿﻿import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

// ==================== 类型定义 ====================

/** 零售概览统计行 */
interface AnalyticsSummaryRow {
  orderCount: number | string;
  salesAmount: number | string;
  deliveryFeeTotal: number | string;
  avgOrderAmount: number | string;
  userCount: number | string;
}

/** 销售趋势行 */
interface SalesTrendRow {
  period: string;
  orderCount: number | string;
  salesAmount: number | string;
  deliveryFee: number | string;
}

/** 平台对比行 */
interface PlatformComparisonRow {
  platform: string;
  orderCount: number | string;
  salesAmount: number | string;
  avgOrderAmount: number | string;
}

/** 热销商品行 */
interface TopProductRow {
  productId: number;
  productName: string;
  totalQty: number | string;
  totalAmount: number | string;
  orderCount: number | string;
}

export async function getAnalyticsSummary(params: {
  tenantId: string; storeId?: number; startDate?: string; endDate?: string;
}) {
  const { tenantId, storeId, startDate, endDate } = params;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (storeId) { conditions.push("store_id = ?"); values.push(storeId); }
  if (startDate) { conditions.push("created_at >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("created_at <= ?"); values.push(endDate); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const stats = await queryOneWithTenant<AnalyticsSummaryRow>(
    `SELECT
       COUNT(*) AS orderCount,
       COALESCE(SUM(pay_amount), 0) AS salesAmount,
       COALESCE(SUM(delivery_fee), 0) AS deliveryFeeTotal,
       COALESCE(AVG(pay_amount), 0) AS avgOrderAmount,
       COUNT(DISTINCT user_id) AS userCount
     FROM t_retail_order ${where} AND order_status IN ('PAID', 'COMPLETED', 'DELIVERING')`,
    values, tenantId
  );
  return {
    orderCount: Number(stats?.orderCount ?? 0),
    salesAmount: Number(stats?.salesAmount ?? 0),
    avgOrderAmount: Math.round(Number(stats?.avgOrderAmount ?? 0) * 100) / 100,
    userCount: Number(stats?.userCount ?? 0),
    deliveryFeeTotal: Number(stats?.deliveryFeeTotal ?? 0),
    grossProfit: Math.round(Number(stats?.salesAmount ?? 0) * 0.3 * 100) / 100,
  };
}

export async function getSalesTrend(params: {
  tenantId: string; storeId?: number; period?: string;
  startDate?: string; endDate?: string;
}) {
  const { tenantId, storeId, period = "day", startDate, endDate } = params;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (storeId) { conditions.push("store_id = ?"); values.push(storeId); }
  if (startDate) { conditions.push("created_at >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("created_at <= ?"); values.push(endDate); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  let dateFormat: string;
  if (period === "month") dateFormat = "DATE_FORMAT(created_at, '%Y-%m')";
  else if (period === "week") dateFormat = "DATE_FORMAT(created_at, '%Y-%u')";
  else dateFormat = "DATE(created_at)";
  return queryWithTenant<SalesTrendRow>(
    `SELECT ${dateFormat} AS period,
            COUNT(*) AS orderCount,
            COALESCE(SUM(pay_amount), 0) AS salesAmount,
            COALESCE(SUM(delivery_fee), 0) AS deliveryFee
     FROM t_retail_order ${where} AND order_status IN ('PAID', 'COMPLETED', 'DELIVERING')
     GROUP BY period ORDER BY period`,
    values, tenantId
  );
}

export async function getPlatformComparison(params: {
  tenantId: string; storeId?: number; startDate?: string; endDate?: string;
}) {
  const { tenantId, storeId, startDate, endDate } = params;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (storeId) { conditions.push("store_id = ?"); values.push(storeId); }
  if (startDate) { conditions.push("created_at >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("created_at <= ?"); values.push(endDate); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  return queryWithTenant<PlatformComparisonRow>(
    `SELECT platform,
            COUNT(*) AS orderCount,
            COALESCE(SUM(pay_amount), 0) AS salesAmount,
            COALESCE(AVG(pay_amount), 0) AS avgOrderAmount
     FROM t_retail_order ${where} AND platform IS NOT NULL
     GROUP BY platform ORDER BY salesAmount DESC`,
    values, tenantId
  );
}

export async function getTopProducts(params: {
  tenantId: string; storeId?: number; startDate?: string; endDate?: string; limit?: number;
}) {
  const { tenantId, storeId, startDate, endDate, limit = 10 } = params;
  const conditions = ["roi.tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (storeId) { conditions.push("ro.store_id = ?"); values.push(storeId); }
  if (startDate) { conditions.push("ro.created_at >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("ro.created_at <= ?"); values.push(endDate); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  return queryWithTenant<TopProductRow>(
    `SELECT roi.product_id AS productId, roi.product_name AS productName,
            SUM(roi.quantity) AS totalQty,
            SUM(roi.subtotal) AS totalAmount,
            COUNT(DISTINCT roi.order_id) AS orderCount
     FROM t_retail_order_item roi
     LEFT JOIN t_retail_order ro ON ro.id = roi.order_id
     ${where}
     GROUP BY roi.product_id, roi.product_name
     ORDER BY totalQty DESC LIMIT ?`,
    [...values, limit], tenantId
  );
}