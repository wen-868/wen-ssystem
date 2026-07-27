import { query, queryOne, pool } from "../../shared/db";
import logger from "../../shared/logger";
import type { Request } from "express";

/** 审计日志行 */
interface AuditLogRow {
  id: number;
  tenant_id: string;
  user_id: number;
  username: string;
  action: string;
  resource_type: string;
  resource_id: string;
  ip: string;
  user_agent: string;
  request_params: string;
  response_data: string;
  status: string;
  error_message: string;
  created_at: string;
}

export async function listAuditLogs(params: {
  page: number;
  pageSize: number;
  tenantId: string;
  userId?: number;
  action?: string;
  resourceType?: string;
  dateStart?: string;
  dateEnd?: string;
}) {
  const { page, pageSize, tenantId, userId, action, resourceType, dateStart, dateEnd } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const sqlParams: unknown[] = [tenantId];

  if (userId) {
    conditions.push("user_id = ?");
    sqlParams.push(userId);
  }
  if (action) {
    conditions.push("action = ?");
    sqlParams.push(action);
  }
  if (resourceType) {
    conditions.push("resource_type = ?");
    sqlParams.push(resourceType);
  }
  if (dateStart) {
    conditions.push("DATE(created_at) >= ?");
    sqlParams.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    sqlParams.push(dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_audit_log ${where}`,
    sqlParams
  );
  const total = totalRow?.total ?? 0;

  const records = await query<AuditLogRow>(
    `SELECT id, user_id AS userId, user_name AS userName, role,
            action, resource_type AS resourceType, resource_id AS resourceId,
            detail, ip, user_agent AS userAgent, created_at AS createdAt
     FROM t_audit_log ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, pageSize, offset]
  );

  return { total, page, pageSize, records };
}

export async function getAuditStatistics(tenantId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const monthStart = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [todayCount, weekCount, monthCount, actionDist, userDist] = await Promise.all([
    queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM t_audit_log WHERE tenant_id = ? AND DATE(created_at) = ?`, [tenantId, today]),
    queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM t_audit_log WHERE tenant_id = ? AND DATE(created_at) >= ?`, [tenantId, weekStart]),
    queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM t_audit_log WHERE tenant_id = ? AND DATE(created_at) >= ?`, [tenantId, monthStart]),
    query<{ action: string; cnt: number }>(`SELECT action, COUNT(*) AS cnt FROM t_audit_log WHERE tenant_id = ? AND DATE(created_at) >= ? GROUP BY action ORDER BY cnt DESC`, [tenantId, weekStart]),
    query<{ userName: string; cnt: number }>(`SELECT user_name AS userName, COUNT(*) AS cnt FROM t_audit_log WHERE tenant_id = ? AND DATE(created_at) >= ? GROUP BY user_name ORDER BY cnt DESC LIMIT 10`, [tenantId, weekStart])
  ]);

  return {
    todayCount: todayCount?.cnt ?? 0,
    weekCount: weekCount?.cnt ?? 0,
    monthCount: monthCount?.cnt ?? 0,
    actionDistribution: actionDist,
    userDistribution: userDist
  };
}

export interface LogAuditParams {
  userId: number;
  userName: string;
  role: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  detail?: string;
  tenantId: number;
  req: Request;
}

export function writeAuditLog(p: LogAuditParams): void {
  const ip = (p.req.ip || p.req.socket?.remoteAddress || "").replace("::ffff:", "");
  const userAgent = p.req.headers["user-agent"] || "";

  pool
    .query(
      `INSERT INTO t_audit_log (user_id, user_name, role, action, resource_type, resource_id, detail, ip, user_agent, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.userId, p.userName, p.role, p.action, p.resourceType, p.resourceId ?? null, p.detail ?? null, ip, userAgent, p.tenantId]
    )
    .catch((err: unknown) => {
      logger.error("[audit] 写入审计日志失败:", err);
    });
}