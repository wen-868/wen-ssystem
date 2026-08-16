import { query, queryOne, pool } from "../../shared/db";
import type { RowDataPacket } from "mysql2/promise";
import { getStats } from "../../middleware/response-tracker";
import logger from "../../shared/logger";
import { sendNotification } from "../../shared/notification-sender";

interface StatusCodeRow extends RowDataPacket {
  status_code: number;
  count: number;
}

interface DateCountRow extends RowDataPacket {
  date: string;
  count: number;
}

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
      const code = (row as StatusCodeRow).status_code;
      statusCodes[code] = (statusCodes[code] || 0) + (row as DateCountRow).count;
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
        date: (row as DateCountRow).date,
        count: (row as DateCountRow).count || 0,
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
  const result = await query<ExpiringTenant>(
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

export async function notifyExpiringTenants(tenantIds: string[]): Promise<number> {
  if (tenantIds.length === 0) return 0;

  let sent = 0;
  for (const tenantId of tenantIds) {
    try {
      // 查租户公司名与到期时间（t_tenant.id 为 varchar）
      const tenant = await queryOne<{ company_name?: string; expire_at?: string | Date }>(
        `SELECT company_name, expire_at FROM t_tenant WHERE id = ?`,
        [tenantId]
      );
      // 查租户管理员（优先 admin / tenant_admin）
      const adminUser = await queryOne<{ id: number }>(
        `SELECT id FROM t_sys_user
         WHERE tenant_id = ? AND username IN ('admin', 'tenant_admin')
         ORDER BY FIELD(username, 'admin', 'tenant_admin')
         LIMIT 1`,
        [tenantId]
      );
      if (!adminUser) {
        logger.warn(`[monitor] 租户 ${tenantId} 无管理员用户，跳过发送到期通知`);
        continue;
      }

      const companyName = tenant?.company_name || "您的店铺";
      const expireAt = tenant?.expire_at;
      const content = expireAt
        ? `${companyName} 的系统服务将于 ${String(expireAt).slice(0, 10)} 到期，请及时续费以免影响正常使用。`
        : `${companyName} 的系统服务即将到期，请及时续费以免影响正常使用。`;
      await sendNotification(pool, {
        recipientId: adminUser.id,
        recipientType: "ADMIN",
        title: "订阅即将到期提醒",
        content,
        type: "SYSTEM",
        tenantId,
      });
      sent++;
      logger.info(`[monitor] 已向租户 ${tenantId} 写入到期系统通知（接收人 ${adminUser.id}）`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[monitor] 发送到期通知失败 tenant=${tenantId}: ${msg}`);
    }
  }

  logger.info(`[monitor] 到期通知发送完成：${sent}/${tenantIds.length} 个租户`);
  return sent;
}
