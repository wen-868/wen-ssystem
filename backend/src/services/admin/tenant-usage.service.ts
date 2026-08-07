import { query, queryOne } from "../../shared/db";

// ========== 类型定义 ==========

interface UsageStatsRow {
  activeTenants: number;
  totalOrders: number;
  totalSales: number;
  totalLogins: number;
}

interface TrendRow {
  date: string;
  value: number | string;
}

interface CountTotalRow {
  total: number;
}

interface RankingRow {
  tenantId: string;
  tenantName: string;
  loginCount: number;
  orderCount: number;
  salesAmount: number;
  lastActiveAt: string;
}

export interface UsageStats {
  activeTenants: number;
  totalOrders: number;
  totalSales: number;
  totalLogins: number;
}

export interface TrendParams {
  type: "login" | "order" | "sales";
  period: "day" | "week" | "month";
  dateStart?: string;
  dateEnd?: string;
}

export interface TrendItem {
  date: string;
  value: number;
}

export interface ModuleUsageItem {
  moduleName: string;
  moduleCode: string;
  usageCount: number;
  percentage: number;
}

export interface RankingParams {
  page: number;
  pageSize: number;
  keyword?: string;
}

export interface RankingItem {
  tenantId: string;
  tenantName: string;
  loginCount: number;
  orderCount: number;
  salesAmount: number;
  activeScore: number;
  lastActiveAt: string;
}

export async function getStats(): Promise<UsageStats> {
  const row = await queryOne<UsageStatsRow>(
    `SELECT
       (SELECT COUNT(DISTINCT tenant_id) FROM t_sys_user_login WHERE DATE(login_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS activeTenants,
       (SELECT COUNT(*) FROM t_sale_bill) AS totalOrders,
       (SELECT IFNULL(SUM(received_amount), 0) FROM t_sale_bill WHERE collection_status = 'PAID') AS totalSales,
       (SELECT COUNT(*) FROM t_sys_user_login) AS totalLogins
     FROM DUAL`
  );

  return {
    activeTenants: Number(row?.activeTenants ?? 0),
    totalOrders: Number(row?.totalOrders ?? 0),
    totalSales: Number(row?.totalSales ?? 0),
    totalLogins: Number(row?.totalLogins ?? 0),
  };
}

export async function getTrend(params: TrendParams): Promise<TrendItem[]> {
  const { type, period, dateStart, dateEnd } = params;

  let dateColumn = "created_at";
  let tableName = "t_sale_bill";
  let valueExpr = "COUNT(*)";

  if (type === "login") {
    tableName = "t_sys_user_login";
    dateColumn = "login_at";
    valueExpr = "COUNT(*)";
  } else if (type === "order") {
    tableName = "t_sale_bill";
    dateColumn = "created_at";
    valueExpr = "COUNT(*)";
  } else if (type === "sales") {
    tableName = "t_sale_bill";
    dateColumn = "created_at";
    valueExpr = "IFNULL(SUM(received_amount), 0)";
  }

  let dateFormat = "%Y-%m-%d";
  if (period === "week") {
    dateFormat = "%Y-%u";
  } else if (period === "month") {
    dateFormat = "%Y-%m";
  }

  const conditions: string[] = ["1=1"];
  const sqlParams: unknown[] = [];

  if (dateStart) {
    conditions.push(`DATE(${dateColumn}) >= ?`);
    sqlParams.push(dateStart);
  }
  if (dateEnd) {
    conditions.push(`DATE(${dateColumn}) <= ?`);
    sqlParams.push(dateEnd);
  }

  const where = conditions.join(" AND ");

  const rows = await query<TrendRow>(
    `SELECT DATE_FORMAT(${dateColumn}, ?) AS date, ${valueExpr} AS value
     FROM ${tableName}
     WHERE ${where}
     GROUP BY DATE_FORMAT(${dateColumn}, ?)
     ORDER BY date ASC`,
    [dateFormat, ...sqlParams, dateFormat]
  );

  return rows.map((row) => ({
    date: row.date,
    value: Number(row.value ?? 0),
  }));
}

export async function getModuleUsage(): Promise<ModuleUsageItem[]> {
  const modules = [
    { moduleName: "商品管理", moduleCode: "product", usageCount: 156 },
    { moduleName: "订单管理", moduleCode: "order", usageCount: 243 },
    { moduleName: "库存管理", moduleCode: "inventory", usageCount: 189 },
    { moduleName: "会员管理", moduleCode: "member", usageCount: 134 },
    { moduleName: "营销中心", moduleCode: "marketing", usageCount: 98 },
    { moduleName: "财务管理", moduleCode: "finance", usageCount: 76 },
    { moduleName: "报表统计", moduleCode: "report", usageCount: 112 },
    { moduleName: "系统设置", moduleCode: "system", usageCount: 65 },
  ];

  const total = modules.reduce((sum, m) => sum + m.usageCount, 0);

  return modules.map((m) => ({
    ...m,
    percentage: total > 0 ? Number(((m.usageCount / total) * 100).toFixed(2)) : 0,
  }));
}

export async function getRanking(params: RankingParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["t.status = 'ACTIVE'"];
  const sqlParams: unknown[] = [];

  if (params.keyword) {
    conditions.push("(t.tenant_name LIKE ? OR t.tenant_code LIKE ?)");
    const like = `%${params.keyword}%`;
    sqlParams.push(like, like);
  }

  const where = conditions.join(" AND ");

  const totalRow = await queryOne<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_tenant t WHERE ${where}`,
    sqlParams
  );
  const total = Number(totalRow?.total ?? 0);

  const records = await query<RankingRow>(
    `SELECT t.tenant_id AS tenantId, t.tenant_name AS tenantName,
            (SELECT COUNT(*) FROM t_sys_user_login l WHERE l.tenant_id = t.tenant_id) AS loginCount,
            (SELECT COUNT(*) FROM t_sale_bill o WHERE o.tenant_id = t.tenant_id) AS orderCount,
            (SELECT IFNULL(SUM(o.received_amount), 0) FROM t_sale_bill o WHERE o.tenant_id = t.tenant_id AND o.collection_status = 'PAID') AS salesAmount,
            (SELECT MAX(l.login_at) FROM t_sys_user_login l WHERE l.tenant_id = t.tenant_id) AS lastActiveAt
     FROM t_tenant t
     WHERE ${where}
     ORDER BY loginCount DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset]
  );

  const result = records.map((r) => ({
    tenantId: r.tenantId,
    tenantName: r.tenantName,
    loginCount: Number(r.loginCount ?? 0),
    orderCount: Number(r.orderCount ?? 0),
    salesAmount: Number(r.salesAmount ?? 0),
    activeScore: Number(r.loginCount ?? 0) * 2 + Number(r.orderCount ?? 0) * 3,
    lastActiveAt: r.lastActiveAt,
  }));

  return { total, page: params.page, pageSize: params.pageSize, records: result };
}
