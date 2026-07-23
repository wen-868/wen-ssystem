import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

// ===== 类型定义 =====
/** 总数和活跃数统计行 */
interface TotalActiveRow {
  total: number | string;
  active: number | string | null;
}

/** COUNT(*) AS cnt 查询行 */
interface CountCntRow {
  cnt: number | string;
}

/** 优惠券趋势查询行 */
interface CouponTrendRow {
  period: string;
  issuedCount: number | string;
  usedCount: number | string | null;
}

/** 限时折扣趋势查询行 */
interface DiscountTrendRow {
  period: string;
  count: number | string;
  amount: number | string | null;
}

/** 活动效果基础统计行 */
interface ActivityEffectBaseRow {
  totalUsers: number | string;
  uniqueUsers: number | string | null;
  usedCount: number | string | null;
}

/** 活动效果订单统计行 */
interface ActivityEffectOrderRow {
  orderCount: number | string | null;
  totalOrderAmount: number | string | null;
  totalDiscountAmount: number | string | null;
}

/** 转化率趋势查询行 */
interface ConversionTrendRow {
  period: string;
  issuedCount: number | string;
  usedCount: number | string | null;
  uniqueUsers: number | string | null;
}

/** 活动排行查询行 */
interface ActivityRankingRow {
  activityId: number | string;
  activityName: string;
  activityType: string;
  totalIssued: number | string;
  usedCount: number | string | null;
  uniqueUsers: number | string | null;
}

export async function getMarketingOverview(params: { tenantId: string; startDate?: string; endDate?: string }) {
  const { tenantId, startDate, endDate } = params;
  const dateConditions: string[] = [];
  const dateValues: unknown[] = [tenantId];
  if (startDate) { dateConditions.push("created_at >= ?"); dateValues.push(startDate); }
  if (endDate) { dateConditions.push("created_at <= ?"); dateValues.push(endDate); }
  const couponStats = await queryOneWithTenant<TotalActiveRow>(`SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active FROM t_coupon_template WHERE tenant_id = ?`, [tenantId], tenantId);
  const discountStats = await queryOneWithTenant<TotalActiveRow>(`SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active FROM t_limited_discount WHERE tenant_id = ?`, [tenantId], tenantId);
  const giftRuleStats = await queryOneWithTenant<TotalActiveRow>(`SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active FROM t_gift_rule WHERE tenant_id = ?`, [tenantId], tenantId);
  const fullReductionStats = await queryOneWithTenant<TotalActiveRow>(`SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active FROM t_promotion_activity WHERE tenant_id = ?`, [tenantId], tenantId);

  return {
    totalActivities: Number(couponStats?.total ?? 0) + Number(discountStats?.total ?? 0) + Number(giftRuleStats?.total ?? 0) + Number(fullReductionStats?.total ?? 0),
    activeActivities: Number(couponStats?.active ?? 0) + Number(discountStats?.active ?? 0) + Number(giftRuleStats?.active ?? 0) + Number(fullReductionStats?.active ?? 0),
    coupons: { total: Number(couponStats?.total ?? 0), active: Number(couponStats?.active ?? 0) },
    limitedDiscounts: { total: Number(discountStats?.total ?? 0), active: Number(discountStats?.active ?? 0) },
    giftRules: { total: Number(giftRuleStats?.total ?? 0), active: Number(giftRuleStats?.active ?? 0) },
    fullReductions: { total: Number(fullReductionStats?.total ?? 0), active: Number(fullReductionStats?.active ?? 0) },
  };
}

export async function getActivityStats(_params: { tenantId: string; startDate?: string; endDate?: string; activityType?: string }) {
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

export async function getSingleActivityStats(activityId: number, activityType: string, _tenantId: string) {
  return {
    activityId, activityType,
    participants: 0, orderCount: 0, orderAmount: 0,
    discountAmount: 0, conversionRate: 0, roi: 0,
  };
}

export async function getCouponStats(tenantId: string) {
  const issued = await queryOneWithTenant<CountCntRow>("SELECT COUNT(*) AS cnt FROM t_user_coupon WHERE tenant_id = ?", [tenantId], tenantId);
  const used = await queryOneWithTenant<CountCntRow>("SELECT COUNT(*) AS cnt FROM t_user_coupon WHERE tenant_id = ? AND status = 'USED'", [tenantId], tenantId);
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

  const couponTrend = await queryWithTenant<CouponTrendRow>(
    `SELECT ${dateFormat} AS period, COUNT(*) AS issuedCount, COUNT(CASE WHEN status = 'USED' THEN 1 END) AS usedCount FROM t_user_coupon WHERE tenant_id = ? ${dateWhere} GROUP BY period ORDER BY period`,
    dateValues, tenantId
  );
  const discountTrend = await queryWithTenant<DiscountTrendRow>(
    `SELECT ${dateFormat} AS period, COUNT(*) AS count, COALESCE(SUM(total_sales_amount), 0) AS amount FROM t_limited_discount WHERE tenant_id = ? ${dateWhere} GROUP BY period ORDER BY period`,
    dateValues, tenantId
  );
  return { couponTrend, discountTrend };
}

export async function getActivityComparison(_params: { tenantId: string; activityIds?: number[]; startDate?: string; endDate?: string }) {
  return [];
}

// ========== 活动效果分析 ==========
export async function getActivityEffectAnalysis(params: { tenantId: string; activityId: number; activityType: string; startDate?: string; endDate?: string }) {
  const { tenantId, activityId, activityType, startDate, endDate } = params;

  // 基础统计
  const baseStats = await queryOneWithTenant<ActivityEffectBaseRow>(
    `SELECT COUNT(*) AS totalUsers, 
            COUNT(DISTINCT customer_id) AS uniqueUsers,
            SUM(CASE WHEN status = 'USED' THEN 1 ELSE 0 END) AS usedCount
     FROM t_user_coupon 
     WHERE tenant_id = ? AND template_id = ?`,
    [tenantId, activityId], tenantId
  );

  // 订单关联统计
  const orderStats = await queryOneWithTenant<ActivityEffectOrderRow>(
    `SELECT COUNT(DISTINCT order_id) AS orderCount,
            COALESCE(SUM(order_amount), 0) AS totalOrderAmount,
            COALESCE(SUM(discount_amount), 0) AS totalDiscountAmount
     FROM t_order_coupon 
     WHERE tenant_id = ? AND coupon_id IN (SELECT id FROM t_user_coupon WHERE template_id = ? AND tenant_id = ?)`,
    [tenantId, activityId, tenantId], tenantId
  );

  // 转化率计算
  const totalUsers = Number(baseStats?.totalUsers ?? 0);
  const usedCount = Number(baseStats?.usedCount ?? 0);
  const orderCount = Number(orderStats?.orderCount ?? 0);

  return {
    activityId,
    activityType,
    totalUsers,
    uniqueUsers: Number(baseStats?.uniqueUsers ?? 0),
    usedCount,
    usedRate: totalUsers > 0 ? Math.round((usedCount / totalUsers) * 10000) / 100 : 0,
    orderCount,
    conversionRate: usedCount > 0 ? Math.round((orderCount / usedCount) * 10000) / 100 : 0,
    totalOrderAmount: orderStats?.totalOrderAmount ?? 0,
    totalDiscountAmount: orderStats?.totalDiscountAmount ?? 0,
    avgOrderAmount: orderCount > 0 ? Math.round((Number(orderStats?.totalOrderAmount ?? 0) / orderCount) * 100) / 100 : 0,
    roi: orderCount > 0 ? Math.round((Number(orderStats?.totalOrderAmount ?? 0) / Number(orderStats?.totalDiscountAmount ?? 1)) * 100) / 100 : 0,
  };
}

export async function getActivityConversionTrend(params: { tenantId: string; activityId: number; period?: string }) {
  const { tenantId, activityId, period = "day" } = params;

  let dateFormat: string;
  if (period === "month") dateFormat = "DATE_FORMAT(created_at, '%Y-%m')";
  else if (period === "week") dateFormat = "DATE_FORMAT(created_at, '%Y-%u')";
  else dateFormat = "DATE(created_at)";

  const trend = await queryWithTenant<ConversionTrendRow>(
    `SELECT ${dateFormat} AS period,
            COUNT(*) AS issuedCount,
            SUM(CASE WHEN status = 'USED' THEN 1 ELSE 0 END) AS usedCount,
            COUNT(DISTINCT customer_id) AS uniqueUsers
     FROM t_user_coupon
     WHERE tenant_id = ? AND template_id = ?
     GROUP BY period ORDER BY period`,
    [tenantId, activityId], tenantId
  );

  return trend.map((item) => ({
    period: item.period,
    issuedCount: Number(item.issuedCount),
    usedCount: Number(item.usedCount),
    uniqueUsers: Number(item.uniqueUsers),
    usedRate: Number(item.issuedCount) > 0 ? Math.round((Number(item.usedCount) / Number(item.issuedCount)) * 10000) / 100 : 0,
  }));
}

export async function getActivityRanking(params: { tenantId: string; rankBy?: string; startDate?: string; endDate?: string }) {
  const { tenantId, rankBy = "usedRate", startDate, endDate } = params;

  const conditions = ["uc.tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (startDate) { conditions.push("uc.created_at >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("uc.created_at <= ?"); values.push(endDate); }
  const where = conditions.join(" AND ");

  const ranking = await queryWithTenant<ActivityRankingRow>(
    `SELECT ct.id AS activityId, ct.name AS activityName, ct.type AS activityType,
            COUNT(uc.id) AS totalIssued,
            SUM(CASE WHEN uc.status = 'USED' THEN 1 ELSE 0 END) AS usedCount,
            COUNT(DISTINCT uc.customer_id) AS uniqueUsers
     FROM t_coupon_template ct
     LEFT JOIN t_user_coupon uc ON uc.template_id = ct.id AND uc.tenant_id = ct.tenant_id
     WHERE ct.tenant_id = ? AND ct.status = 'ACTIVE'
     GROUP BY ct.id, ct.name, ct.type
     ORDER BY ${rankBy === "usedRate" ? "usedCount / NULLIF(COUNT(uc.id), 0) DESC" : "usedCount DESC"}
     LIMIT 20`,
    [tenantId], tenantId
  );

  return ranking.map((item) => ({
    activityId: item.activityId,
    activityName: item.activityName,
    activityType: item.activityType,
    totalIssued: Number(item.totalIssued),
    usedCount: Number(item.usedCount),
    uniqueUsers: Number(item.uniqueUsers),
    usedRate: Number(item.totalIssued) > 0 ? Math.round((Number(item.usedCount) / Number(item.totalIssued)) * 10000) / 100 : 0,
  }));
}