import { query } from "../../shared/db.js";

export async function getDbStatus() {
  // 模拟数据库状态
  const threadCount = await query<any>("SHOW STATUS LIKE 'Threads_connected'");
  const slowQueries = await query<any>("SHOW STATUS LIKE 'Slow_queries'");
  return {
    connections: parseInt(threadCount[0]?.Value || '0'),
    slowQueries: parseInt(slowQueries[0]?.Value || '0'),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage().heapUsed
  };
}

export async function getApiStats() {
  return {
    qps: Math.floor(Math.random() * 100) + 10,
    avgResponseTime: Math.floor(Math.random() * 200) + 50,
    errorRate: (Math.random() * 2).toFixed(2)
  };
}

export async function getExpiringTenants() {
  return query<any>(
    `SELECT id, tenant_code AS tenantCode, company_name AS companyName, expire_at AS expireAt,
     DATEDIFF(expire_at, NOW()) AS daysRemaining
     FROM tenant WHERE expire_at IS NOT NULL AND expire_at <= DATE_ADD(NOW(), INTERVAL 7 DAY) AND status = 'ACTIVE' ORDER BY expire_at ASC`
  );
}

export async function notifyExpiringTenants(tenantIds: number[]) {
  // 模拟发送通知
  return { notified: tenantIds.length };
}