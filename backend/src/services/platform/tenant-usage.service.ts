import { query, queryOne } from "../../shared/db";
import { getModuleUsage } from "../admin/tenant-usage.service";

/**
 * R97-01: 租户使用统计（平台视角，全租户）
 *
 * 返回结构对齐 saas-admin/src/views/TenantUsage.vue 期望：
 * - usage-stats：{ overview: { totalUsers, totalOrders, totalSales, totalProducts }, trendData, moduleUsage }
 * - rank：数组 [{ tenantName, planName, value, percentage, lastActive }]
 */

export interface TenantUsageParams {
  tenantId?: string;
  metric?: string;
  dateStart?: string;
  dateEnd?: string;
  period?: "day" | "week" | "month";
}

export interface UsageStatsResult {
  overview: {
    totalUsers: number;
    totalOrders: number;
    totalSales: number;
    totalProducts: number;
  };
  trendData: { period: string; value: number }[];
  moduleUsage: { moduleName: string; moduleCode: string; usageCount: number; percentage: number }[];
}

interface CountRow {
  total: number;
}

interface TrendRow {
  period: string;
  value: number;
}

interface RankRow {
  tenantId: string;
  tenantName: string;
  planName: string | null;
  loginCount: number;
  orderCount: number;
  salesAmount: number;
  userCount: number;
  lastActiveAt: string | null;
}

function tenantCondition(tenantId?: string): { cond: string; params: unknown[] } {
  if (tenantId) {
    return { cond: "AND tenant_id = ?", params: [tenantId] };
  }
  return { cond: "", params: [] };
}

/** 租户使用统计（overview + 趋势 + 模块占比） */
export async function getUsageStats(params: TenantUsageParams): Promise<UsageStatsResult> {
  const { cond, params: tenantParams } = tenantCondition(params.tenantId);

  const [usersRow, ordersRow, salesRow, productsRow] = await Promise.all([
    queryOne<CountRow>(`SELECT COUNT(*) AS total FROM t_sys_user WHERE 1=1 ${cond}`, tenantParams),
    queryOne<CountRow>(`SELECT COUNT(*) AS total FROM t_sale_bill WHERE 1=1 ${cond}`, tenantParams),
    queryOne<CountRow>(
      `SELECT IFNULL(SUM(received_amount), 0) AS total FROM t_sale_bill
       WHERE collection_status = 'PAID' ${cond}`,
      tenantParams
    ),
    queryOne<CountRow>(`SELECT COUNT(*) AS total FROM t_product_spu WHERE 1=1 ${cond}`, tenantParams),
  ]);

  // 趋势口径：按 metric 选择统计表/指标
  const metric = params.metric || "order_count";
  let tableName = "t_sale_bill";
  let dateColumn = "created_at";
  let valueExpr = "COUNT(*)";
  let extraCond = "";

  if (metric === "user_activity") {
    tableName = "t_sys_user_login";
    dateColumn = "login_at";
  } else if (metric === "sales_amount") {
    valueExpr = "IFNULL(SUM(received_amount), 0)";
    extraCond = " AND collection_status = 'PAID'";
  }

  const period = params.period || "day";
  const dateFormat = period === "week" ? "%Y-%u" : period === "month" ? "%Y-%m" : "%Y-%m-%d";

  const conditions: string[] = ["1=1"];
  const trendParams: unknown[] = [];
  if (params.tenantId) {
    conditions.push("tenant_id = ?");
    trendParams.push(params.tenantId);
  }
  if (params.dateStart) {
    conditions.push(`DATE(${dateColumn}) >= ?`);
    trendParams.push(params.dateStart);
  }
  if (params.dateEnd) {
    conditions.push(`DATE(${dateColumn}) <= ?`);
    trendParams.push(params.dateEnd);
  }

  const trendRows = await query<TrendRow>(
    `SELECT DATE_FORMAT(${dateColumn}, ?) AS period, ${valueExpr} AS value
     FROM ${tableName}
     WHERE ${conditions.join(" AND ")}${extraCond}
     GROUP BY DATE_FORMAT(${dateColumn}, ?)
     ORDER BY period ASC
     LIMIT 90`,
    [dateFormat, ...trendParams, dateFormat]
  );

  const moduleUsage = await getModuleUsage();

  return {
    overview: {
      totalUsers: Number(usersRow?.total ?? 0),
      totalOrders: Number(ordersRow?.total ?? 0),
      totalSales: Number(salesRow?.total ?? 0),
      totalProducts: Number(productsRow?.total ?? 0),
    },
    trendData: trendRows.map((row) => ({
      period: row.period,
      value: Number(row.value ?? 0),
    })),
    moduleUsage,
  };
}

/** 租户使用排行（按指标排序，返回数组） */
export async function getRank(params: { sortBy?: string; limit?: number }) {
  const sortBy = params.sortBy || "order_count";
  const limit = Math.min(Math.max(params.limit || 10, 1), 100);

  // 白名单映射，防止 SQL 注入
  const orderExprMap: Record<string, string> = {
    order_count: "orderCount",
    sales_amount: "salesAmount",
    user_count: "userCount",
    activity: "(loginCount * 2 + orderCount * 3)",
  };
  const orderExpr = orderExprMap[sortBy] || orderExprMap.order_count;

  const rows = await query<RankRow>(
    `SELECT t.tenant_id AS tenantId, t.tenant_name AS tenantName,
            (SELECT s.plan_name FROM t_subscription s
             WHERE s.tenant_id = t.tenant_id ORDER BY s.created_at DESC LIMIT 1) AS planName,
            (SELECT COUNT(*) FROM t_sys_user_login l WHERE l.tenant_id = t.tenant_id) AS loginCount,
            (SELECT COUNT(*) FROM t_sale_bill o WHERE o.tenant_id = t.tenant_id) AS orderCount,
            (SELECT IFNULL(SUM(o.received_amount), 0) FROM t_sale_bill o
             WHERE o.tenant_id = t.tenant_id AND o.collection_status = 'PAID') AS salesAmount,
            (SELECT COUNT(*) FROM t_sys_user u WHERE u.tenant_id = t.tenant_id) AS userCount,
            (SELECT MAX(l.login_at) FROM t_sys_user_login l WHERE l.tenant_id = t.tenant_id) AS lastActiveAt
     FROM t_tenant t
     WHERE t.status = 'ACTIVE'
     ORDER BY ${orderExpr} DESC
     LIMIT ?`,
    [limit]
  );

  const total = rows.reduce((sum, r) => sum + valueOf(r, sortBy), 0);

  return rows.map((r) => {
    const value = valueOf(r, sortBy);
    return {
      tenantName: r.tenantName,
      planName: r.planName || "",
      value,
      percentage: total > 0 ? Number(((value / total) * 100).toFixed(2)) : 0,
      lastActive: r.lastActiveAt || "",
    };
  });
}

function valueOf(r: RankRow, sortBy: string): number {
  switch (sortBy) {
    case "sales_amount":
      return Number(r.salesAmount ?? 0);
    case "user_count":
      return Number(r.userCount ?? 0);
    case "activity":
      return Number(r.loginCount ?? 0) * 2 + Number(r.orderCount ?? 0) * 3;
    default:
      return Number(r.orderCount ?? 0);
  }
}
