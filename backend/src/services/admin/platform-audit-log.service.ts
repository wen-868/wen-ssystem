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
    `SELECT COUNT(*) AS total FROM t_platform_audit_log WHERE ${where}`,
    sqlParams
  );
  const total = Number(totalRow?.total ?? 0);

  const records = await query<AuditLogItem[]>(
    `SELECT id, admin_id AS adminId, admin_name AS adminName,
            type, module, action, description, ip,
            user_agent AS userAgent, created_at AS createdAt
     FROM t_platform_audit_log
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
     FROM t_platform_audit_log WHERE id = ?`,
    [id]
  );
}

/**
 * C1-2：平台审计日志「写入」函数
 *
 * 背景：本文件此前**只有读、全仓无写入方**（`INSERT INTO t_platform_audit_log` 0 命中），
 * 平台写操作（代登录 / 临时扩容）无处留痕，故新增本写函数。既有读函数签名与实现未改。
 *
 * 列对应（逐条来自仓库 DDL，非推测）：
 * - admin_id / admin_name / action / target_type / target_id / detail / ip
 *   → `docs/migrations/080_平台管理员.sql:24-38`（t_platform_audit_log 建表）
 * - module → `docs/migrations/153_select_columns_fill.sql:27`（ALTER 补列）
 * 说明：`type` / `description` / `user_agent` 三列在仓库 DDL 中**不存在**
 * （上方读函数仍引用，属存量缺陷，C1-2 不越界回改）。为避免写入不存在的列，
 * 本函数把「审计类型 + 中文描述」放进 detail JSON，并写入 module 列。
 */
export interface PlatformAuditLogInput {
  /** 操作人（平台管理员）ID 与姓名 */
  adminId: number;
  adminName: string;
  /** 业务模块（写入 module 列，如 tenant / plan） */
  module: string;
  /** 操作类型（写入 action 列，如 PROXY_LOGIN / QUOTA_EXPAND） */
  action: string;
  /** 审计类型（写入 detail.type，弥补 type 列缺失） */
  auditType?: string;
  /** 中文描述（写入 detail.description，弥补 description 列缺失） */
  description?: string;
  targetType?: string | null;
  targetId?: string | number | null;
  /** 结构化明细（与 auditType/description 合并后写入 detail 列） */
  detail?: Record<string, unknown> | null;
  ip?: string | null;
}

export async function insertPlatformAuditLog(input: PlatformAuditLogInput): Promise<number> {
  const detail = {
    type: input.auditType ?? input.module,
    description: input.description ?? "",
    ...(input.detail ?? {}),
  };

  const result = await query<{ insertId: number }>(
    `INSERT INTO t_platform_audit_log
       (admin_id, admin_name, action, target_type, target_id, detail, ip, module)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.adminId,
      input.adminName,
      input.action,
      input.targetType ?? null,
      input.targetId == null ? null : String(input.targetId),
      JSON.stringify(detail),
      input.ip ?? null,
      input.module,
    ]
  );

  return Number((result as unknown as { insertId?: number }).insertId ?? 0);
}
