import { query, queryOne } from "../../shared/db";

export interface AuditLogListParams {
  page: number;
  pageSize: number;
  type?: string;
  adminId?: number;
  module?: string;
  dateStart?: string;
  dateEnd?: string;
  keyword?: string;
}

export interface AuditLogItem {
  id: number;
  adminId: number;
  adminName: string;
  type: string;
  module: string;
  action: string;
  description: string;
  ip: string;
  userAgent: string;
  createdAt: string;
}

export async function listAuditLogs(params: AuditLogListParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["1=1"];
  const sqlParams: unknown[] = [];

  if (params.type) {
    conditions.push("type = ?");
    sqlParams.push(params.type);
  }
  if (params.adminId !== undefined) {
    conditions.push("admin_id = ?");
    sqlParams.push(params.adminId);
  }
  if (params.module) {
    conditions.push("module = ?");
    sqlParams.push(params.module);
  }
  if (params.dateStart) {
    conditions.push("DATE(created_at) >= ?");
    sqlParams.push(params.dateStart);
  }
  if (params.dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    sqlParams.push(params.dateEnd);
  }
  if (params.keyword) {
    conditions.push("(description LIKE ? OR admin_name LIKE ? OR action LIKE ?)");
    const like = `%${params.keyword}%`;
    sqlParams.push(like, like, like);
  }

  const where = conditions.join(" AND ");

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM platform_audit_log WHERE ${where}`,
    sqlParams
  );
  const total = Number(totalRow?.total ?? 0);

  const records = await query<AuditLogItem[]>(
    `SELECT id, admin_id AS adminId, admin_name AS adminName,
            type, module, action, description, ip,
            user_agent AS userAgent, created_at AS createdAt
     FROM platform_audit_log
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset]
  );

  return { total, page: params.page, pageSize: params.pageSize, records };
}

export async function getAuditLogById(id: number) {
  return queryOne<AuditLogItem>(
    `SELECT id, admin_id AS adminId, admin_name AS adminName,
            type, module, action, description, ip,
            user_agent AS userAgent, created_at AS createdAt
     FROM platform_audit_log WHERE id = ?`,
    [id]
  );
}
