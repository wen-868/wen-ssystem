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

/** 订单中心统计行 */
interface OrderCenterCountRow {
  cnt: number | string;
  amount?: number | string;
}

/** 渠道分布行 */
interface OrderCenterChannelRow {
  channel: string | null;
  count: number | string;
}

/** 订单趋势行 */
interface OrderCenterTrendRow {
  date: string | Date;
  count: number | string;
}

/**
 * 订单中心统计（今日订单/金额、待处理、异常、渠道占比、近30天趋势）
 * 基于 t_retail_order 聚合，替代前端 mockStats/渠道占比/订单趋势
 */
export async function getOrderCenterStats(params: { tenantId: string; storeId?: number }) {
  const { tenantId, storeId } = params;
  const storeCondition = storeId ? "AND store_id = ?" : "";
  const values: unknown[] = storeId ? [tenantId, storeId] : [tenantId];

  const today = await queryOneWithTenant<OrderCenterCountRow>(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(pay_amount), 0) AS amount
     FROM t_retail_order
     WHERE tenant_id = ? AND DATE(created_at) = CURDATE() ${storeCondition}`,
    values,
    tenantId
  );
  const pending = await queryOneWithTenant<OrderCenterCountRow>(
    `SELECT COUNT(*) AS cnt
     FROM t_retail_order
     WHERE tenant_id = ? AND (payment_status = 'UNPAID' OR order_status = 'PENDING') ${storeCondition}`,
    values,
    tenantId
  );
  const exception = await queryOneWithTenant<OrderCenterCountRow>(
    `SELECT COUNT(*) AS cnt
     FROM t_retail_order
     WHERE tenant_id = ? AND order_status IN ('CANCELLED', 'REJECTED', 'FAILED') ${storeCondition}`,
    values,
    tenantId
  );
  const distribution = await queryWithTenant<OrderCenterChannelRow>(
    `SELECT platform AS channel, COUNT(*) AS count
     FROM t_retail_order
     WHERE tenant_id = ? AND platform IS NOT NULL
       AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) ${storeCondition}
     GROUP BY platform ORDER BY count DESC`,
    values,
    tenantId
  );
  const trend = await queryWithTenant<OrderCenterTrendRow>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM t_retail_order
     WHERE tenant_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) ${storeCondition}
     GROUP BY DATE(created_at) ORDER BY date`,
    values,
    tenantId
  );

  const totalChannelCount = distribution.reduce((sum, d) => sum + Number(d.count), 0);
  return {
    todayOrders: Number(today?.cnt ?? 0),
    todayAmount: Number(today?.amount ?? 0),
    pendingCount: Number(pending?.cnt ?? 0),
    exceptionCount: Number(exception?.cnt ?? 0),
    channelDistribution: distribution.map((d) => ({
      channel: d.channel,
      count: Number(d.count),
      ratio: totalChannelCount > 0 ? Math.round((Number(d.count) / totalChannelCount) * 10000) / 100 : 0,
    })),
    orderTrend: trend.map((d) => ({
      date: d.date instanceof Date ? d.date.toISOString().slice(0, 10) : String(d.date).slice(0, 10),
      count: Number(d.count),
    })),
  };
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
