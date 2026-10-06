/**
 * 平台总后台 - 数据统计服务
 *
 * 功能：平台总览统计
 */

import { query, queryOne } from "../../shared/db";
import { getStats as getResponseTrackerStats } from "../../shared/response-time-tracker";

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

/** 计数归一：null/非法 ⇒ 0（计数为 0 是真实语义；「无载体」用 null 显式表达，不在此列） */
function toCount(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * 最近告警文案：`MM-DD HH:mm <message>`（message 超长截断）。
 * 无记录或时间解析失败 ⇒ null（前端展示「暂无告警记录」，不造时间）。
 */
function formatAlarm(at: unknown, message: unknown): string | null {
  if (at == null || at === "") return null;
  const date = at instanceof Date ? at : new Date(String(at).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return null;
  const text = message == null ? "" : String(message);
  const brief = text.length > 40 ? `${text.slice(0, 40)}…` : text;
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(
    date.getMinutes()
  )}${brief ? ` ${brief}` : ""}`;
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
  /**
   * 近 30 天每日新增租户；仅返回有新增的日期，不补零。
   * `cumCount`（S3-20）＝截至该日的租户总数，供趋势图右轴「累计」折线使用。
   */
  tenantTrend: { date: string; newCount: number; cumCount: number }[];
  /** 收入构成（本月，按套餐聚合；amount 为元，amountWan 为万元） */
  incomeComposition: { name: string; amount: number; amountWan: number }[];
  planDistribution: { planName: string; count: number }[];
  tenantStatus: { status: string; count: number }[];
  recentTenants: { companyName: string; planName: string; status: string; createdAt: string }[];
  // ── S3-10 / S3-11：大盘经营指标与右侧面板（无载体维度一律 null，另见 `unavailable`） ──
  todayNewTenants: number;
  todayNewPaid: number;
  tenantDelta: number;
  incomeDelta: number | null;
  totalOrders: number;
  todayOrders: number;
  aiCost: number;
  aiTokens: number;
  activeRate: string | null;
  todos: {
    audit: number | null;
    arrears: number;
    ticket: number;
    approval: number | null;
  };
  health: {
    apiSuccessRate: number | null;
    avgResponseMs: number | null;
    storageUsedGb: number;
    storagePercent: number | null;
    aiGatewaySuccessRate: number | null;
    messageQueue: string | null;
  };
  lastAlarm: string | null;
  /** 无载体字段清单（key + 原因），前端据此展示「— / 待接入」而不是 0 */
  unavailable: { key: string; reason: string }[];
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
  todayNewTenants: number | string | null;
  todayNewPaid: number | string | null;
  newTenantsMonth: number | string | null;
  newTenantsLastMonth: number | string | null;
  monthRevenue: number | string | null;
  lastMonthRevenue: number | string | null;
  totalOrders: number | string | null;
  todayOrders: number | string | null;
  aiCostMonth: number | string | null;
  aiTokensMonth: number | string | null;
  arrearsTenants: number | string | null;
  openTickets: number | string | null;
  alarmAt: unknown;
  alarmMessage: unknown;
  storageUsedBytes: number | string | null;
  aiCalls24h: number | string | null;
  aiCallsOk24h: number | string | null;
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
       (SELECT COUNT(*) FROM t_platform_admin) AS totalAdmins,
       -- S3-10：今日新增租户 / 其中已付费（付费口径＝该租户已有 payment_status='PAID' 的订阅）
       (SELECT COUNT(*) FROM t_tenant WHERE DATE(created_at) = CURDATE()) AS todayNewTenants,
       (SELECT COUNT(DISTINCT s.tenant_id) FROM t_subscription s
          JOIN t_tenant t2 ON t2.id = s.tenant_id
         WHERE DATE(t2.created_at) = CURDATE() AND s.payment_status = 'PAID') AS todayNewPaid,
       -- S3-10：租户环比（本月新增 VS 上月新增，取绝对差；前端「较上月 +N」）
       (SELECT COUNT(*) FROM t_tenant WHERE created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS newTenantsMonth,
       (SELECT COUNT(*) FROM t_tenant
         WHERE created_at >= DATE_FORMAT(NOW() - INTERVAL 1 MONTH, '%Y-%m-01')
           AND created_at <  DATE_FORMAT(NOW(), '%Y-%m-01')) AS newTenantsLastMonth,
       -- S3-10：收入环比基准（自然月口径：本月 / 上月，均限 status='ACTIVE'）
       (SELECT IFNULL(SUM(amount), 0) FROM t_subscription
         WHERE status = 'ACTIVE' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS monthRevenue,
       (SELECT IFNULL(SUM(amount), 0) FROM t_subscription
         WHERE status = 'ACTIVE'
           AND created_at >= DATE_FORMAT(NOW() - INTERVAL 1 MONTH, '%Y-%m-01')
           AND created_at <  DATE_FORMAT(NOW(), '%Y-%m-01')) AS lastMonthRevenue,
       -- S3-10：平台订单总量 / 今日（口径＝平台订阅订单，与 getRevenueStatistics.totalOrders 同源）
       (SELECT COUNT(*) FROM t_subscription) AS totalOrders,
       (SELECT COUNT(*) FROM t_subscription WHERE DATE(created_at) = CURDATE()) AS todayOrders,
       -- S3-10：大模型消耗（t_ai_usage_daily 本月费用合计 / 总 Token）
       (SELECT IFNULL(SUM(total_cost), 0) FROM t_ai_usage_daily
         WHERE stat_date >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS aiCostMonth,
       (SELECT IFNULL(SUM(total_tokens), 0) FROM t_ai_usage_daily
         WHERE stat_date >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS aiTokensMonth,
       -- S3-11：待办计数（欠费＝有待结算金额的账单所属租户数；工单＝待处理+处理中）
       (SELECT COUNT(DISTINCT tenant_id) FROM t_platform_settlement
         WHERE status <> 'CANCELLED' AND pending_amount > 0) AS arrearsTenants,
       (SELECT COUNT(*) FROM t_support_ticket WHERE status IN ('PENDING', 'PROCESSING')) AS openTickets,
       -- S3-11：最近告警（t_error_logs 中最近一条 FATAL/ERROR/WARN）
       (SELECT created_at FROM t_error_logs
         WHERE severity IN ('FATAL', 'ERROR', 'WARN')
         ORDER BY created_at DESC, id DESC LIMIT 1) AS alarmAt,
       (SELECT message FROM t_error_logs
         WHERE severity IN ('FATAL', 'ERROR', 'WARN')
         ORDER BY created_at DESC, id DESC LIMIT 1) AS alarmMessage,
       -- S3-11：平台存储已用（t_upload_file 未软删行合计；无平台总配额载体 ⇒ 只给已用值）
       (SELECT IFNULL(SUM(file_size), 0) FROM t_upload_file WHERE status = 1) AS storageUsedBytes,
       -- S3-11：AI 网关健康（t_ai_audit_log 近 24h 调用数与成功数）
       (SELECT COUNT(*) FROM t_ai_audit_log
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) AS aiCalls24h,
       (SELECT COUNT(*) FROM t_ai_audit_log
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND success = 1) AS aiCallsOk24h
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

  /* ── S3-20：趋势图「累计（右轴）」 ──
   * 口径：cumCount = 截至该日期的租户总数 = 窗口开始前已有租户数 + 窗口内累计新增。
   * 窗口开始前基数由 totalTenants 与窗口内新增合计反推（不额外查库、不补零行）。
   * 数据异常（基数算成负数）时按 0 兜底，宁可少算也不编造。 */
  const trendTotalInWindow = tenantTrend.reduce((sum, row) => sum + Number(row.newCount ?? 0), 0);
  const trendBase = Math.max(0, Number(stats?.totalTenants ?? 0) - trendTotalInWindow);
  let trendRunning = 0;
  const tenantTrendWithCum = tenantTrend.map((row) => {
    const newCount = Number(row.newCount ?? 0);
    trendRunning += newCount;
    return {
      date: String(row.date ?? ""),
      newCount,
      cumCount: trendBase + trendRunning,
    };
  });

  /* ── S3-10：环比派生（后端一次算好，前端零换算） ── */
  const todayNewTenants = toCount(stats?.todayNewTenants);
  const todayNewPaid = toCount(stats?.todayNewPaid);
  const newTenantsMonth = toCount(stats?.newTenantsMonth);
  const newTenantsLastMonth = toCount(stats?.newTenantsLastMonth);
  const monthRevenue = toCount(stats?.monthRevenue);
  const lastMonthRevenue = toCount(stats?.lastMonthRevenue);
  // 租户环比＝本月新增 − 上月新增（绝对差，设计稿口径「较上月 +86」）
  const tenantDelta = newTenantsMonth - newTenantsLastMonth;
  // 收入环比＝(本月 − 上月) / 上月 × 100（上月为 0 时不计算，返回 null 而不是 0/∞）
  const incomeDelta =
    lastMonthRevenue > 0
      ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 1000) / 10
      : null;
  const aiCost = toCount(stats?.aiCostMonth);
  const aiTokens = toCount(stats?.aiTokensMonth);

  /* ── S3-11：待办 / 系统健康 / 最近告警 ──
   * 有载体的维度给真实聚合；无载体的维度一律返回 null 并在 unavailable 里逐条说明
   * （系统不内置默认值、不填 0 冒充，守「禁模拟数据」铁律）。 */
  const arrearsTenants = toCount(stats?.arrearsTenants);
  const openTickets = toCount(stats?.openTickets);

  const tracker = getResponseTrackerStats();
  const apiSuccessRate =
    tracker.totalRequests > 0
      ? Math.round(((tracker.totalRequests - tracker.errorCount) / tracker.totalRequests) * 10000) / 100
      : null;
  const avgResponseMs = tracker.totalRequests > 0 ? tracker.avgResponseTime : null;

  const storageUsedBytes = toCount(stats?.storageUsedBytes);
  const storageUsedGb = Math.round((storageUsedBytes / 1024 ** 3) * 100) / 100;

  const aiCalls24h = toCount(stats?.aiCalls24h);
  const aiCallsOk24h = toCount(stats?.aiCallsOk24h);
  const aiGatewaySuccessRate = aiCalls24h > 0 ? Math.round((aiCallsOk24h / aiCalls24h) * 10000) / 100 : null;

  const lastAlarm = formatAlarm(stats?.alarmAt, stats?.alarmMessage);

  const todos = {
    // 待审核租户：后端实际写入/比较的租户状态只有 ACTIVE/DISABLED/EXPIRED，无 PENDING 写入方
    // ⇒ 无载体，返回 null（不拿恒 0 的计数冒充「没有待审核」）。
    audit: null as number | null,
    arrears: arrearsTenants,
    ticket: openTickets,
    // 提现审批 / 配额扩容审批：仓库无审批流表 ⇒ 无载体。
    approval: null as number | null,
  };

  const health = {
    /** API 成功率（%，近 60 秒进程内滑窗；窗口内无请求 ⇒ null） */
    apiSuccessRate,
    /** 平均响应（毫秒；窗口内无请求 ⇒ null） */
    avgResponseMs,
    /** 平台存储已用（GB，后端一次换算） */
    storageUsedGb,
    /** 存储水位（%；平台总配额无载体 ⇒ null，不按租户配额汇总冒充） */
    storagePercent: null as number | null,
    /** AI 网关成功率（t_ai_audit_log 近 24h；无调用 ⇒ null） */
    aiGatewaySuccessRate,
    /** 消息队列（仓库无 MQ 载体 ⇒ null） */
    messageQueue: null as string | null,
  };

  const unavailable: { key: string; reason: string }[] = [
    {
      key: "activeRate",
      reason: "近 7 日活跃率无载体：仓库无租户级登录/活跃时间列（t_tenant 无 last_login 类字段），不按其它维度近似",
    },
    {
      key: "todos.audit",
      reason: "待审核租户无载体：t_tenant 实际写入/比较的状态只有 ACTIVE/DISABLED/EXPIRED（tenant-status-stats.service 已取证），无 PENDING 写入方",
    },
    {
      key: "todos.approval",
      reason: "提现审批 / 配额扩容审批无载体：仓库无审批流表",
    },
    {
      key: "health.storagePercent",
      reason: "平台存储水位无载体：无「平台总配额」列/配置（t_tenant_config.storage_limit 是租户级），不把租户配额加总冒充平台总配额",
    },
    {
      key: "health.messageQueue",
      reason: "消息队列无载体：本项目未引入 MQ 组件",
    },
  ];

  const todayOrders = toCount(stats?.todayOrders);
  const totalOrders = toCount(stats?.totalOrders);

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
    // ── S3-10：大盘 9 项经营指标 ──
    todayNewTenants,
    todayNewPaid,
    tenantDelta,
    incomeDelta,
    totalOrders,
    todayOrders,
    aiCost,
    aiTokens,
    activeRate: null as string | null,
    // ── S3-11：待办 / 健康 / 最近告警 ──
    todos,
    health,
    lastAlarm,
    unavailable,
    incomeTrend: incomeTrend.map((row) => ({
      period: row.period,
      amount: Number(row.amount ?? 0),
    })),
    tenantTrend: tenantTrendWithCum,
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
