/**
 * 平台总后台 - 数据统计服务
 *
 * 功能：平台总览统计
 */

import { query, queryOne } from "../../shared/db";

// ─── 数据统计 ────────────────────────────────────────────────

/**
 * 平台总览统计
 */
export async function getPlatformOverview() {
  const stats = await queryOne<any>(
    `SELECT
       (SELECT COUNT(*) FROM t_tenant) AS totalTenants,
       (SELECT COUNT(*) FROM t_tenant WHERE status = 'ACTIVE') AS activeTenants,
       (SELECT COUNT(*) FROM t_tenant WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS newTenantsWeek,
       (SELECT COUNT(*) FROM t_subscription WHERE status = 'ACTIVE') AS activeSubscriptions,
       (SELECT IFNULL(SUM(amount), 0) FROM t_subscription WHERE status = 'ACTIVE' AND DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS monthlyRevenue,
       (SELECT COUNT(*) FROM t_platform_admin) AS totalAdmins
     FROM DUAL`
  );

  // 近7天新增租户趋势
  const trend = await query<any[]>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM t_tenant
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  );

  // 套餐分布
  const planDistribution = await query<any[]>(
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
  const stats = await queryOne<any>(
    `SELECT
       (SELECT COUNT(*) FROM t_tenant) AS totalTenants,
       (SELECT COUNT(*) FROM t_tenant WHERE status = 'ACTIVE') AS activeTenants,
       (SELECT COUNT(*) FROM t_tenant WHERE status = 'DISABLED') AS disabledTenants,
       (SELECT COUNT(*) FROM t_tenant WHERE status = 'EXPIRED') AS expiredTenants,
       (SELECT COUNT(*) FROM t_tenant WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS newTenantsMonth,
       (SELECT COUNT(*) FROM t_tenant WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS newTenantsWeek
     FROM DUAL`
  );

  // 近30天新增租户趋势
  const trend = await query<any[]>(
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
  const stats = await queryOne<any>(
    `SELECT
       (SELECT IFNULL(SUM(amount), 0) FROM t_subscription WHERE status = 'ACTIVE') AS totalRevenue,
       (SELECT IFNULL(SUM(amount), 0) FROM t_subscription WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS monthlyRevenue,
       (SELECT IFNULL(SUM(amount), 0) FROM t_subscription WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS weeklyRevenue,
       (SELECT IFNULL(SUM(amount), 0) FROM t_subscription WHERE YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())) AS currentMonthRevenue,
       (SELECT COUNT(*) FROM t_subscription WHERE payment_status = 'PAID') AS paidCount,
       (SELECT COUNT(*) FROM t_subscription) AS totalOrders
     FROM DUAL`
  );

  // 近6个月收入趋势
  const trend = await query<any[]>(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, IFNULL(SUM(amount), 0) AS revenue, COUNT(*) AS count
     FROM t_subscription
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
     GROUP BY DATE_FORMAT(created_at, '%Y-%m')
     ORDER BY month ASC`
  );

  // 各套餐收入分布
  const planRevenue = await query<any[]>(
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