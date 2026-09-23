import { query, queryOne } from "../../shared/db";

/**
 * 平台审计日志读写服务
 *
 * ★ R101-C4-1b 段二（包C）· A8 根因修复（凌舟裁定 §六.1）
 *
 * 缺陷事实：本文件原「读」路径 SELECT 了 DDL 中**不存在**的三列 ——
 * `type` / `description` / `user_agent`（依据：`docs/migrations/080_平台管理员.sql:24-36`
 * 的 t_platform_audit_log 只有 id/admin_id/admin_name/action/target_type/target_id/detail/ip/created_at；
 * `docs/migrations/153_select_columns_fill.sql:26-27` 只补 `ip_address` / `module`）
 * ⇒ 真库执行该 SELECT 必 `ER_BAD_FIELD_ERROR`（Unknown column）。
 *
 * 修复口径（零 DDL：不新增表、不新增列）：
 * 1. SELECT/WHERE 只引用 **DDL 真实存在** 的列；
 * 2. `type` / `description` 是 C1-2 写函数（下方 insertPlatformAuditLog）落进 `detail` JSON 的字段，
 *    改由 `JSON_UNQUOTE(JSON_EXTRACT(detail, '$.type'))` 派生 ⇒ 过滤参数 `type` 与
 *    `keyword`（原先按 description 模糊匹配）由「引用不存在列」变为**真实可用**；
 * 3. `userAgent` 无任何列载体、也无法从其它列派生 ⇒ 从返回体**移除**（不填假值），
 *    属 `GET /api/platform/audit-logs`、`GET /api/platform/audit-logs/:id` 的**契约变更**（已随回传卡报备）；
 * 4. 新增 `action` / `adminName` 两个过滤参数（均为真实列），供
 *    `GET /api/platform/monitor/proxy-audit` 复用本读路径（禁止另写一套同表 SQL）；
 * 5. 返回体新增真实列 `targetType` / `targetId` / `ipAddress` / `detail`（纯增量，不破坏既有消费方）。
 */
export interface AuditLogListParams {
  page: number;
  pageSize: number;
  type?: string;
  adminId?: number;
  /** 操作人姓名（精确匹配 admin_name 列）；代登录审计的「操作人」筛选用 */
  adminName?: string;
  module?: string;
  /** 操作类型（精确匹配 action 列）；代登录审计用 PROXY_LOGIN */
  action?: string;
  dateStart?: string;
  dateEnd?: string;
  keyword?: string;
}

export interface AuditLogItem {
  id: number;
  adminId: number;
  adminName: string;
  /** detail.type 派生（无值 ⇒ null，不填假值） */
  type: string | null;
  module: string | null;
  action: string;
  /** detail.description 派生（无值 ⇒ null） */
  description: string | null;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  ipAddress: string | null;
  /** detail 列（JSON 对象；非对象/解析失败 ⇒ null） */
  detail: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * 读路径投影：只含 DDL 真实存在的列（`ip` 来自 080、`ip_address`/`module` 来自 153）。
 * `type` / `description` 从 detail JSON 派生 —— 列名不存在的缺陷已在此根因修复。
 */
const AUDIT_LOG_SELECT = `SELECT id, admin_id AS adminId, admin_name AS adminName,
            JSON_UNQUOTE(JSON_EXTRACT(detail, '$.type')) AS type,
            module, action,
            JSON_UNQUOTE(JSON_EXTRACT(detail, '$.description')) AS description,
            target_type AS targetType, target_id AS targetId,
            ip, ip_address AS ipAddress, detail,
            created_at AS createdAt
     FROM t_platform_audit_log`;

/** detail JSON 归一：mysql2 的 JSON 列通常已反序列化为对象，字符串则解析，其余 ⇒ null */
function normalizeDetail(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function textOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value);
  return text === "" ? null : text;
}

interface AuditLogRawRow {
  id: unknown;
  adminId: unknown;
  adminName: unknown;
  type: unknown;
  module: unknown;
  action: unknown;
  description: unknown;
  targetType: unknown;
  targetId: unknown;
  ip: unknown;
  ipAddress: unknown;
  detail: unknown;
  createdAt: unknown;
}

function normalizeAuditRow(row: AuditLogRawRow): AuditLogItem {
  const detail = normalizeDetail(row.detail);
  // 兜底：库内 detail 结构异常（非 JSON 对象）时，仍尽力从 detail 取 type/description；
  // 取不到一律 null —— 绝不填假值。
  const detailType = detail?.type == null ? null : String(detail.type);
  const detailDescription = detail?.description == null ? null : String(detail.description);
  return {
    id: Number(row.id),
    adminId: Number(row.adminId),
    adminName: String(row.adminName ?? ""),
    type: textOrNull(row.type) ?? detailType,
    module: textOrNull(row.module),
    action: String(row.action ?? ""),
    description: textOrNull(row.description) ?? detailDescription,
    targetType: textOrNull(row.targetType),
    targetId: textOrNull(row.targetId),
    ip: textOrNull(row.ip),
    ipAddress: textOrNull(row.ipAddress),
    detail,
    createdAt: row.createdAt == null ? "" : String(row.createdAt),
  };
}

export async function listAuditLogs(params: AuditLogListParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["1=1"];
  const sqlParams: unknown[] = [];

  if (params.type) {
    conditions.push("JSON_UNQUOTE(JSON_EXTRACT(detail, '$.type')) = ?");
    sqlParams.push(params.type);
  }
  if (params.adminId !== undefined) {
    conditions.push("admin_id = ?");
    sqlParams.push(params.adminId);
  }
  if (params.adminName) {
    conditions.push("admin_name = ?");
    sqlParams.push(params.adminName);
  }
  if (params.module) {
    conditions.push("module = ?");
    sqlParams.push(params.module);
  }
  if (params.action) {
    conditions.push("action = ?");
    sqlParams.push(params.action);
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
    conditions.push(
      "(JSON_UNQUOTE(JSON_EXTRACT(detail, '$.description')) LIKE ? OR admin_name LIKE ? OR action LIKE ?)"
    );
    const like = `%${params.keyword}%`;
    sqlParams.push(like, like, like);
  }

  const where = conditions.join(" AND ");

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_platform_audit_log WHERE ${where}`,
    sqlParams
  );
  const total = Number(totalRow?.total ?? 0);

  const rows = await query<AuditLogRawRow>(
    `${AUDIT_LOG_SELECT}
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset]
  );

  return {
    total,
    page: params.page,
    pageSize: params.pageSize,
    records: (Array.isArray(rows) ? rows : []).map(normalizeAuditRow),
  };
}

export async function getAuditLogById(id: number) {
  const row = await queryOne<AuditLogRawRow>(`${AUDIT_LOG_SELECT} WHERE id = ?`, [id]);
  return row ? normalizeAuditRow(row) : null;
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
