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

/**
 * 元 → 万元（后端一次性四舍五入 2 位）。
 *
 * R101-S2-01 裁定③：**换算放后端，前端零换算**。
 * 接口同时给「元」（精度不丢）与「万元」两种表示，前端只做千分位格式化，
 * 不做任何除法——避免每个调用点各写一遍换算、且四舍五入口径不一致。
 */
function toWan(amount: number): number {
  return Math.round(Number(amount || 0) / 10000 * 100) / 100;
}

/** 平台看板总览 */
export interface PlatformDashboardOverview {
  totalTenants: number;
  activeTenants: number;
  monthlyRevenue: number;
  /** 本月收入（万元，后端四舍五入 2 位）——前端标注「万元」处取此字段 */
  monthlyRevenueWan: number;
  pendingTenants: number;
  totalRevenue: number;
  /** 累计收入（万元，后端四舍五入 2 位） */
  totalRevenueWan: number;
  newTenantsWeek: number;
  activeSubscriptions: number;
  totalAdmins: number;
  incomeTrend: { period: string; amount: number }[];
  /** 近 30 天每日新增租户；仅返回有新增的日期，不补零 */
  tenantTrend: { date: string; newCount: number }[];
  /** 收入构成（本月，按套餐聚合；amount 为元，amountWan 为万元） */
  incomeComposition: { name: string; amount: number; amountWan: number }[];
  planDistribution: { planName: string; count: number }[];
  tenantStatus: { status: string; count: number }[];
  recentTenants: { companyName: string; planName: string; status: string; createdAt: string }[];
}

/** 每日新增租户行 */
interface TenantTrendRow {
  date: string;
  newCount: number;
}

/** 收入构成行（按套餐聚合本月收入） */
interface IncomeCompositionRow {
  name: string;
  amount: number;
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

  const [incomeTrend, tenantTrend, incomeComposition, planDistribution, tenantStatus, recentTenants] =
    await Promise.all([
      query<IncomeTrendRow>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m') AS period, IFNULL(SUM(amount), 0) AS amount
       FROM t_subscription
       WHERE status = 'ACTIVE' AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY period ASC`
      ),
      // 批 3：近 30 天每日新增租户。用 DATE_FORMAT 而非 DATE()，
      // 保证 date 一定是 'YYYY-MM-DD' 字符串（DATE() 在 mysql2 下可能返回 Date 对象，
      // 直接喂给前端图表会出现 'Mon Aug 15 2026 ...' 这类非预期格式）。
      // 只返回有新增的日期，**不补零**——补零等于用 0 冒充真实数据点。
      query<TenantTrendRow>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COUNT(*) AS newCount
       FROM t_tenant
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
       ORDER BY date ASC`
      ),
      // 批 3：收入构成（本月，按套餐聚合）。口径「本月」= created_at 不早于本月 1 号。
      query<IncomeCompositionRow>(
        `SELECT COALESCE(plan_name, '未设置') AS name, IFNULL(SUM(amount), 0) AS amount
       FROM t_subscription
       WHERE status = 'ACTIVE' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
       GROUP BY COALESCE(plan_name, '未设置')
       ORDER BY amount DESC`
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

  const monthlyRevenue = Number(stats?.monthlyRevenue ?? 0);
  const totalRevenue = Number(stats?.totalRevenue ?? 0);

  return {
    totalTenants: Number(stats?.totalTenants ?? 0),
    activeTenants: Number(stats?.activeTenants ?? 0),
    pendingTenants: Number(stats?.pendingTenants ?? 0),
    monthlyRevenue,
    monthlyRevenueWan: toWan(monthlyRevenue),
    totalRevenue,
    totalRevenueWan: toWan(totalRevenue),
    newTenantsWeek: Number(stats?.newTenantsWeek ?? 0),
    activeSubscriptions: Number(stats?.activeSubscriptions ?? 0),
    totalAdmins: Number(stats?.totalAdmins ?? 0),
    incomeTrend: incomeTrend.map((row) => ({
      period: row.period,
      amount: Number(row.amount ?? 0),
    })),
    tenantTrend: tenantTrend.map((row) => ({
      date: String(row.date ?? ""),
      newCount: Number(row.newCount ?? 0),
    })),
    incomeComposition: incomeComposition.map((row) => {
      const amount = Number(row.amount ?? 0);
      return { name: String(row.name ?? ""), amount, amountWan: toWan(amount) };
    }),
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
