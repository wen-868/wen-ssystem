import { query, queryOne } from "../../shared/db";
import { getStats } from "../../middleware/response-tracker";
import logger from "../../shared/logger";

export interface DbStatus {
  connection: "connected" | "disconnected" | "error";
  database: string;
  uptime: number;
  tableCount: number;
}

export interface ApiStats {
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  avgResponseTime: number;
  statusCodes: Record<number, number>;
  todayErrorCount: number;
  weeklyErrorTrend: { date: string; count: number }[];
}

export interface ExpiringTenant {
  id: number;
  tenantCode: string;
  companyName: string;
  contactPerson: string;
  contactMobile: string;
  expireAt: string;
  daysLeft: number;
}

export async function getDbStatus(): Promise<DbStatus> {
  try {
    const result = await queryOne("SELECT DATABASE() AS database_name");
    const dbName = (result as { database_name?: string } | null)?.database_name || "unknown";

    const tablesResult = await query("SHOW TABLES");
    const tableCount = Array.isArray(tablesResult) ? tablesResult.length : 0;

    return {
      connection: "connected",
      database: dbName,
      uptime: 0,
      tableCount,
    };
  } catch {
    return {
      connection: "error",
      database: "unknown",
      uptime: 0,
      tableCount: 0,
    };
  }
}

export async function getApiStats(): Promise<ApiStats> {
  const today = new Date().toISOString().split("T")[0];

  // 从响应时间追踪器获取真实统计数据（最近 60 秒滑动窗口）
  const trackerStats = getStats();

  const [todayErrors, totalErrors, weeklyData] = await Promise.all([
    queryOne(
      `SELECT COUNT(*) AS count FROM t_error_logs WHERE DATE(created_at) = ?`,
      [today]
    ),
    queryOne(`SELECT COUNT(*) AS count FROM t_error_logs`),
    query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count 
       FROM t_error_logs 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
       GROUP BY DATE(created_at) 
       ORDER BY date`
    ),
  ]);

  const statusCodeResult = await query(
    `SELECT status_code, COUNT(*) AS count 
     FROM t_error_logs 
     WHERE status_code IS NOT NULL 
     GROUP BY status_code`
  );

  // 合并追踪器实时状态码与数据库历史状态码
  const statusCodes: Record<number, number> = { ...trackerStats.statusCodes };
  if (Array.isArray(statusCodeResult)) {
    for (const row of statusCodeResult) {
      const code = (row as Record<string, any>).status_code;
      statusCodes[code] = (statusCodes[code] || 0) + (row as Record<string, any>).count;
    }
  }

  const todayErrorCount = (todayErrors as { count?: number } | null)?.count || 0;
  const totalErrorCount = (totalErrors as { count?: number } | null)?.count || 0;

  // totalRequests: 使用追踪器采集的真实请求数
  const totalRequests = trackerStats.totalRequests;

  const weeklyErrorTrend: { date: string; count: number }[] = [];
  if (Array.isArray(weeklyData)) {
    for (const row of weeklyData) {
      weeklyErrorTrend.push({
        date: (row as Record<string, any>).date,
        count: (row as Record<string, any>).count || 0,
      });
    }
  }

  return {
    totalRequests,
    errorCount: totalErrorCount,
    errorRate: totalRequests > 0 ? Math.round((totalErrorCount / totalRequests) * 100 * 100) / 100 : 0,
    avgResponseTime: trackerStats.avgResponseTime,
    statusCodes,
    todayErrorCount,
    weeklyErrorTrend,
  };
}

export async function getExpiringTenants(days: number = 7): Promise<ExpiringTenant[]> {
  const result = await query<any>(
    `SELECT 
       t.id, t.tenant_code AS tenantCode, t.company_name AS companyName,
       t.contact_person AS contactPerson, t.contact_mobile AS contactMobile,
       t.expire_at AS expireAt,
       DATEDIFF(t.expire_at, NOW()) AS daysLeft
     FROM t_tenant t
     WHERE t.status = 'ACTIVE' 
       AND t.expire_at IS NOT NULL 
       AND t.expire_at > NOW() 
       AND DATEDIFF(t.expire_at, NOW()) <= ?
     ORDER BY t.expire_at ASC`,
    [days]
  );

  return Array.isArray(result) ? result : [];
}

export async function notifyExpiringTenants(tenantIds: number[]): Promise<number> {
  if (tenantIds.length === 0) return 0;

  for (const tenantId of tenantIds) {
    logger.info(`[monitor] 发送到期通知给租户: ${tenantId}`);
  }

  return tenantIds.length;
}