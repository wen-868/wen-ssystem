import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

export async function getMarketingOverview(params: { tenantId: string; startDate?: string; endDate?: string }) {
  const { tenantId, startDate, endDate } = params;
  const dateConditions: string[] = [];
  const dateValues: unknown[] = [tenantId];
  if (startDate) { dateConditions.push("created_at >= ?"); dateValues.push(startDate); }
  if (endDate) { dateConditions.push("created_at <= ?"); dateValues.push(endDate); }
  const dateWhere = dateConditions.length > 0 ? `AND ${dateConditions.join(" AND ")}` : "";

  const couponStats = await queryOneWithTenant<any>(`SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active FROM coupon_template WHERE tenant_id = ?`, [tenantId], tenantId);
  const discountStats = await queryOneWithTenant<any>(`SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active FROM limited_discount WHERE tenant_id = ?`, [tenantId], tenantId);
  const giftRuleStats = await queryOneWithTenant<any>(`SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active FROM gift_rule WHERE tenant_id = ?`, [tenantId], tenantId);
  const fullReductionStats = await queryOneWithTenant<any>(`SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active FROM promotion_activity WHERE tenant_id = ?`, [tenantId], tenantId);

  return {
    totalActivities: Number(couponStats?.total ?? 0) + Number(discountStats?.total ?? 0) + Number(giftRuleStats?.total ?? 0) + Number(fullReductionStats?.total ?? 0),
    activeActivities: Number(couponStats?.active ?? 0) + Number(discountStats?.active ?? 0) + Number(giftRuleStats?.active ?? 0) + Number(fullReductionStats?.active ?? 0),
    coupons: { total: Number(couponStats?.total ?? 0), active: Number(couponStats?.active ?? 0) },
    limitedDiscounts: { total: Number(discountStats?.total ?? 0), active: Number(discountStats?.active ?? 0) },
    giftRules: { total: Number(giftRuleStats?.total ?? 0), active: Number(giftRuleStats?.active ?? 0) },
    fullReductions: { total: Number(fullReductionStats?.total ?? 0), active: Number(fullReductionStats?.active ?? 0) },
  };
}

export async function getActivityStats(params: { tenantId: string; startDate?: string; endDate?: string; activityType?: string }) {
  const { tenantId, startDate, endDate, activityType } = params;
  return {
    totalParticipants: 0,
    newParticipants: 0,
    repeatParticipants: 0,
    orderCount: 0,
    orderAmount: 0,
    avgOrderAmount: 0,
    conversionRate: 0,
    totalDiscountAmount: 0,
    avgDiscountAmount: 0,
    discountToRevenueRatio: 0,
    totalCost: 0,
    totalRevenue: 0,
    roi: 0,
  };
}

export async function getSingleActivityStats(activityId: number, activityType: string, tenantId: string) {
  return {
    activityId, activityType,
    participants: 0, orderCount: 0, orderAmount: 0,
    discountAmount: 0, conversionRate: 0, roi: 0,
  };
}

export async function getCouponStats(tenantId: string) {
  const issued = await queryOneWithTenant<any>("SELECT COUNT(*) AS cnt FROM user_coupon WHERE tenant_id = ?", [tenantId], tenantId);
  const used = await queryOneWithTenant<any>("SELECT COUNT(*) AS cnt FROM user_coupon WHERE tenant_id = ? AND status = 'USED'", [tenantId], tenantId);
  const total = Number(issued?.cnt ?? 0);
  const usedCount = Number(used?.cnt ?? 0);
  return {
    couponIssued: total,
    couponUsed: usedCount,
    couponUsageRate: total > 0 ? Math.round((usedCount / total) * 10000) / 100 : 0,
  };
}

export async function getMarketingTrend(params: { tenantId: string; period?: string; startDate?: string; endDate?: string }) {
  const { tenantId, period = "day", startDate, endDate } = params;
  const dateConditions: string[] = [];
  const dateValues: unknown[] = [tenantId];
  if (startDate) { dateConditions.push("created_at >= ?"); dateValues.push(startDate); }
  if (endDate) { dateConditions.push("created_at <= ?"); dateValues.push(endDate); }
  const dateWhere = dateConditions.length > 0 ? `AND ${dateConditions.join(" AND ")}` : "";
  let dateFormat: string;
  if (period === "month") dateFormat = "DATE_FORMAT(created_at, '%Y-%m')";
  else if (period === "week") dateFormat = "DATE_FORMAT(created_at, '%Y-%u')";
  else dateFormat = "DATE(created_at)";

  const couponTrend = await queryWithTenant<any>(
    `SELECT ${dateFormat} AS period, COUNT(*) AS issuedCount, COUNT(CASE WHEN status = 'USED' THEN 1 END) AS usedCount FROM user_coupon WHERE tenant_id = ? ${dateWhere} GROUP BY period ORDER BY period`,
    dateValues, tenantId
  );
  const discountTrend = await queryWithTenant<any>(
    `SELECT ${dateFormat} AS period, COUNT(*) AS count, COALESCE(SUM(total_sales_amount), 0) AS amount FROM limited_discount WHERE tenant_id = ? ${dateWhere} GROUP BY period ORDER BY period`,
    dateValues, tenantId
  );
  return { couponTrend, discountTrend };
}

export async function getActivityRanking(params: { tenantId: string; rankBy?: string; startDate?: string; endDate?: string }) {
  const { tenantId, rankBy = "roi", startDate, endDate } = params;
  return [];
}

export async function getActivityComparison(params: { tenantId: string; activityIds?: number[]; startDate?: string; endDate?: string }) {
  return [];
}