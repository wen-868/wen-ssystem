/**
 * 平台总后台 - 数据统计服务
 *
 * 功能：平台总览统计
 */

import { query, queryOne } from "../../shared/db";

// ─── 类型定义 ─────────────────────────────────────────────────

/** 平台总览统计行 */
interface OverviewStatsRow {
  totalTenants: number;
  activeTenants: number;
  newTenantsWeek: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  totalAdmins: number;
}

/** 趋势行 */
interface TrendRow {
  date: string;
  count: number;
}

/** 套餐分布行 */
interface PlanDistributionRow {
  planCode: string;
  planName: string;
  count: number;
}

/** 租户统计行 */
interface TenantStatisticsRow {
  totalTenants: number;
  activeTenants: number;
  disabledTenants: number;
  expiredTenants: number;
  newTenantsMonth: number;
  newTenantsWeek: number;
}

/** 收入统计行 */
interface RevenueStatsRow {
  totalRevenue: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  currentMonthRevenue: number;
  paidCount: number;
  totalOrders: number;
}

/** 月度收入趋势行 */
interface MonthlyRevenueRow {
  month: string;
  revenue: number;
  count: number;
}

/** 套餐收入行 */
interface PlanRevenueRow {
  planCode: string;
  planName: string;
  revenue: number;
  count: number;
}

// ─── 数据统计 ────────────────────────────────────────────────

/**
 * 平台总览统计
 */
export async function getPlatformOverview() {
  const stats = await queryOne<OverviewStatsRow>(
    `SELECT
       (SELECT COUNT(*) FROM t_tenant) AS totalTenants,
       (SELECT COUNT(*) FROM t_tenant WHERE status = 'ACTIVE') AS activeTenants,
       (SELECT COUNT(*) FROM t_tenant WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS newTenantsWeek,
       (SELECT COUNT(*) FROM t_subscription WHERE status = 'ACTIVE') AS activeSubscriptions,
       (SELECT IFNULL(SUM(amount), 0) FROM t_subscription WHERE status = 'ACTIVE' AND DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS monthlyRevenue,
       (SELECT COUNT(*) FROM t_platform_admin) AS totalAdmins
     `
  );

  // 近7天新增租户趋势
  const trend = await query<TrendRow>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM t_tenant
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  );

  // 套餐分布
  const planDistribution = await query<PlanDistributionRow>(
    `SELECT s.plan_code AS planCode, s.plan_name AS planName, COUNT(*) AS count
     FROM t_subscription s
     WHERE s.status = 'ACTIVE'
     GROUP BY s.plan_code, s.plan_name
     ORDER BY count DESC`
  );

  return {
    totalTenants: Number(stats?.totalTenants ?? 0),
    activeTenants: Number(stats?.activeTenants ?? 0),
    newTenantsWeek: Number(stats?.newTenantsWeek ?? 0),
    activeSubscriptions: Number(stats?.activeSubscriptions ?? 0),
    monthlyRevenue: Number(stats?.monthlyRevenue ?? 0),
    totalAdmins: Number(stats?.totalAdmins ?? 0),
    trend,
    planDistribution
  };
}

/**
 * 租户统计（经营看板-租户维度）
 */
export async function getTenantStatistics() {
  const stats = await queryOne<TenantStatisticsRow>(
    `SELECT
       (SELECT COUNT(*) FROM t_tenant) AS totalTenants,
       (SELECT COUNT(*) FROM t_tenant WHERE status = 'ACTIVE') AS activeTenants,
       (SELECT COUNT(*) FROM t_tenant WHERE status = 'DISABLED') AS disabledTenants,
       (SELECT COUNT(*) FROM t_tenant WHERE status = 'EXPIRED') AS expiredTenants,
       (SELECT COUNT(*) FROM t_tenant WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS newTenantsMonth,
       (SELECT COUNT(*) FROM t_tenant WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS newTenantsWeek
     `
  );

  // 近30天新增租户趋势
  const trend = await query<TrendRow>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM t_tenant
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  );

  return {
    totalTenants: Number(stats?.totalTenants ?? 0),
    activeTenants: Number(stats?.activeTenants ?? 0),
    disabledTenants: Number(stats?.disabledTenants ?? 0),
    expiredTenants: Number(stats?.expiredTenants ?? 0),
    newTenantsMonth: Number(stats?.newTenantsMonth ?? 0),
    newTenantsWeek: Number(stats?.newTenantsWeek ?? 0),
    trend
  };
}

/**
 * 收入统计（经营看板-收入维度）
 */
export async function getRevenueStatistics() {
  const stats = await queryOne<RevenueStatsRow>(
    `SELECT
       (SELECT IFNULL(SUM(amount), 0) FROM t_subscription WHERE status = 'ACTIVE') AS totalRevenue,
       (SELECT IFNULL(SUM(amount), 0) FROM t_subscription WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS monthlyRevenue,
       (SELECT IFNULL(SUM(amount), 0) FROM t_subscription WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS weeklyRevenue,
       (SELECT IFNULL(SUM(amount), 0) FROM t_subscription WHERE YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())) AS currentMonthRevenue,
       (SELECT COUNT(*) FROM t_subscription WHERE payment_status = 'PAID') AS paidCount,
       (SELECT COUNT(*) FROM t_subscription) AS totalOrders
     `
  );

  // 近6个月收入趋势
  const trend = await query<MonthlyRevenueRow>(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, IFNULL(SUM(amount), 0) AS revenue, COUNT(*) AS count
     FROM t_subscription
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
     GROUP BY DATE_FORMAT(created_at, '%Y-%m')
     ORDER BY month ASC`
  );

  // 各套餐收入分布
  const planRevenue = await query<PlanRevenueRow>(
    `SELECT s.plan_code AS planCode, s.plan_name AS planName,
            IFNULL(SUM(s.amount), 0) AS revenue, COUNT(*) AS count
     FROM t_subscription s
     WHERE s.status = 'ACTIVE'
     GROUP BY s.plan_code, s.plan_name
     ORDER BY revenue DESC`
  );

  return {
    totalRevenue: Number(stats?.totalRevenue ?? 0),
    monthlyRevenue: Number(stats?.monthlyRevenue ?? 0),
    weeklyRevenue: Number(stats?.weeklyRevenue ?? 0),
    currentMonthRevenue: Number(stats?.currentMonthRevenue ?? 0),
    paidCount: Number(stats?.paidCount ?? 0),
    totalOrders: Number(stats?.totalOrders ?? 0),
    trend,
    planRevenue
  };
}

// ─── R97-01: 平台看板总览（对齐 saas-admin Dashboard.vue 期望结构） ─────────────────

/** 平台看板总览 */
export interface PlatformDashboardOverview {
  totalTenants: number;
  activeTenants: number;
  monthlyRevenue: number;
  pendingTenants: number;
  totalRevenue: number;
  newTenantsWeek: number;
  activeSubscriptions: number;
  totalAdmins: number;
  incomeTrend: { period: string; amount: number }[];
  planDistribution: { planName: string; count: number }[];
  tenantStatus: { status: string; count: number }[];
  recentTenants: { companyName: string; planName: string; status: string; createdAt: string }[];
}

/** 平台看板总览统计行 */
interface DashboardOverviewStatsRow {
  totalTenants: number;
  activeTenants: number;
  pendingTenants: number;
  monthlyRevenue: number;
  totalRevenue: number;
  newTenantsWeek: number;
  activeSubscriptions: number;
  totalAdmins: number;
}

/** 收入趋势行 */
interface IncomeTrendRow {
  period: string;
  amount: number;
}

/** 租户状态分布行 */
interface TenantStatusRow {
  status: string;
  count: number;
}

/** 近期开通租户行 */
interface RecentTenantRow {
  companyName: string;
  planName: string | null;
  status: string;
  createdAt: string;
}

/**
 * 平台看板总览（saas-admin 平台经营看板页面）
 *
 * 返回结构对齐 saas-admin/src/views/Dashboard.vue 期望：
 * - statCards: totalTenants / activeTenants / monthlyRevenue / pendingTenants（totalRevenue 用于副标题）
 * - incomeTrend: [{ period, amount }]（近6个月收入趋势）
 * - planDistribution: [{ planName, count }]
 * - tenantStatus: [{ status, count }]
 * - recentTenants: [{ companyName, planName, status, createdAt }]
 */
export async function getPlatformDashboardOverview(): Promise<PlatformDashboardOverview> {
  const stats = await queryOne<DashboardOverviewStatsRow>(
    `SELECT
       (SELECT COUNT(*) FROM t_tenant) AS totalTenants,
       (SELECT COUNT(*) FROM t_tenant WHERE status = 'ACTIVE') AS activeTenants,
       (SELECT COUNT(*) FROM t_tenant WHERE status = 'PENDING') AS pendingTenants,
       (SELECT IFNULL(SUM(amount), 0) FROM t_subscription
        WHERE status = 'ACTIVE' AND DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS monthlyRevenue,
       (SELECT IFNULL(SUM(amount), 0) FROM t_subscription WHERE status = 'ACTIVE') AS totalRevenue,
       (SELECT COUNT(*) FROM t_tenant WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS newTenantsWeek,
       (SELECT COUNT(*) FROM t_subscription WHERE status = 'ACTIVE') AS activeSubscriptions,
       (SELECT COUNT(*) FROM t_platform_admin) AS totalAdmins
     `
  );

  const [incomeTrend, planDistribution, tenantStatus, recentTenants] = await Promise.all([
    query<IncomeTrendRow>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS period, IFNULL(SUM(amount), 0) AS amount
       FROM t_subscription
       WHERE status = 'ACTIVE' AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY period ASC`
    ),
    query<PlanDistributionRow>(
      `SELECT COALESCE(s.plan_name, '未设置') AS planName, COUNT(*) AS count
       FROM t_subscription s
       WHERE s.status = 'ACTIVE'
       GROUP BY s.plan_name
       ORDER BY count DESC`
    ),
    query<TenantStatusRow>(
      `SELECT status, COUNT(*) AS count
       FROM t_tenant
       GROUP BY status
       ORDER BY count DESC`
    ),
    query<RecentTenantRow>(
      `SELECT t.company_name AS companyName, t.status,
              (SELECT s.plan_name FROM t_subscription s
               WHERE s.tenant_id = t.id ORDER BY s.created_at DESC LIMIT 1) AS planName,
              DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
       FROM t_tenant t
       ORDER BY t.created_at DESC
       LIMIT 10`
    ),
  ]);

  return {
    totalTenants: Number(stats?.totalTenants ?? 0),
    activeTenants: Number(stats?.activeTenants ?? 0),
    pendingTenants: Number(stats?.pendingTenants ?? 0),
    monthlyRevenue: Number(stats?.monthlyRevenue ?? 0),
    totalRevenue: Number(stats?.totalRevenue ?? 0),
    newTenantsWeek: Number(stats?.newTenantsWeek ?? 0),
    activeSubscriptions: Number(stats?.activeSubscriptions ?? 0),
    totalAdmins: Number(stats?.totalAdmins ?? 0),
    incomeTrend: incomeTrend.map((row) => ({
      period: row.period,
      amount: Number(row.amount ?? 0),
    })),
    planDistribution: planDistribution.map((row) => ({
      planName: row.planName,
      count: Number(row.count ?? 0),
    })),
    tenantStatus: tenantStatus.map((row) => ({
      status: row.status,
      count: Number(row.count ?? 0),
    })),
    recentTenants: recentTenants.map((row) => ({
      companyName: row.companyName,
      planName: row.planName || "",
      status: row.status,
      createdAt: row.createdAt,
    })),
  };
}
