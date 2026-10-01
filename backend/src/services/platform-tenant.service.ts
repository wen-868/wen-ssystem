import { randomUUID } from "node:crypto";
import { query, queryOne } from "../shared/db";
import { makeBizNo } from "../shared/id";
import { AppError } from "../shared/app-error";
import bcrypt from "bcryptjs";

/**
 * S3-150：租户 status 的**对外唯一口径**（字符串）。
 * DB 列 `t_tenant.status` 是 TINYINT（1=启用 / 0=停用），只在服务层做映射；
 * 列表/详情（读）与启停（写）两条路径返回同一形态。
 * 存量库同时存在 `1` 与老写法 `ACTIVE` 两套取值，故两者都按启用处理
 * （与 platform/tenant-status-stats.service.ts 的枚举口径一致）。
 */
export type TenantStatus = "ACTIVE" | "DISABLED";

/** DB 值 ⇒ 对外字符串：0/"0"/"DISABLED" ⇒ DISABLED，其余（1/"1"/"ACTIVE"）⇒ ACTIVE */
export function toTenantStatus(value: number | string | null | undefined): TenantStatus {
  return value === 0 || value === "0" || value === "DISABLED" ? "DISABLED" : "ACTIVE";
}

/** 对外字符串 ⇒ DB TINYINT；取值不在统一口径内 ⇒ null（调用方按 400 处理，不静默兜底） */
export function toTenantStatusValue(value: string | number): 0 | 1 | null {
  const text = String(value);
  if (text === "ACTIVE" || text === "1") return 1;
  if (text === "DISABLED" || text === "0") return 0;
  return null;
}

export interface TenantRecord {
  /** S3-150：t_tenant.id 是 VARCHAR(36)（default / UUID），一律按字符串传递 */
  id: string;
  tenantName: string;
  tenantCode: string;
  contactName: string;
  contactMobile: string;
  contactEmail: string;
  status: TenantStatus;
  expireAt: string | null;
  createdAt: string;
}

/** 库内原始行：status 为 TINYINT（存量数据可能是 1/"1"/"ACTIVE"），出口统一映射为字符串 */
interface TenantRow {
  id: string;
  tenantName: string;
  tenantCode: string;
  contactName: string;
  contactMobile: string;
  contactEmail: string;
  status: number | string | null;
  expireAt: string | null;
  createdAt: string;
}

export interface TenantListResult {
  total: number;
  page: number;
  pageSize: number;
  records: TenantRecord[];
}

interface CountTotalRow {
  total: number;
}

interface IdRow {
  /** t_tenant.id 为 VARCHAR(36) */
  id: string;
}

// ============ 租户列表 ============
export async function listTenants(page: number, pageSize: number, keyword?: string): Promise<TenantListResult> {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (keyword) {
    conditions.push("tenant_name LIKE ?");
    params.push(`%${keyword}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [totalResult, rows] = await Promise.all([
    queryOne<CountTotalRow>(`SELECT COUNT(*) AS total FROM t_tenant ${where}`, params),
    query<TenantRow>(
      `SELECT id, tenant_code AS tenantCode, tenant_name AS tenantName, contact_name AS contactName,
              contact_mobile AS contactMobile, contact_email AS contactEmail,
              status, expire_at AS expireAt, created_at AS createdAt
       FROM t_tenant ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    ),
  ]);

  const records: TenantRecord[] = rows.map((row) => ({ ...row, status: toTenantStatus(row.status) }));
  return { total: totalResult?.total || 0, page, pageSize, records };
}

// ============ 租户详情 ============
export async function getTenantById(id: string): Promise<TenantRecord | null> {
  const row = await queryOne<TenantRow>(
    `SELECT id, tenant_code AS tenantCode, tenant_name AS tenantName, contact_name AS contactName,
            contact_mobile AS contactMobile, contact_email AS contactEmail,
            status, expire_at AS expireAt, created_at AS createdAt
     FROM t_tenant WHERE id = ?`,
    [id]
  );
  return row ? { ...row, status: toTenantStatus(row.status) } : null;
}

// ============ 检查租户名重复 ============
export async function checkTenantNameExists(name: string): Promise<boolean> {
  const existing = await queryOne<IdRow>("SELECT id FROM t_tenant WHERE tenant_name = ?", [name]);
  return !!existing;
}

// ============ 创建租户（含管理员） ============
/**
 * 平台侧开租户（POST /api/platform/tenants）——S3-144 A 项真缺陷修复
 *
 * 原实现的三处缺陷（卡 §一①）：
 *  ① `t_tenant.id` 是 VARCHAR(36) 主键、无自增/默认值，原实现用 `insertId` 取 id ⇒ 恒为 0；
 *  ② 原 INSERT 未提供 016 定义的 NOT NULL 列 `tenant_code` / `company_name` / `contact_person`
 *     ⇒ 非严格模式"租户与管理员已写库、接口却返回 0"的脏写，严格模式 1364 直接失败；
 *  ③ 原 INSERT 写 `status='ACTIVE'`（字符串），而 t_tenant.status 是 TINYINT（1=正常）⇒ 严格模式 1366。
 *
 * 修法（最小改动）：应用层 `randomUUID()` 生成主键、`makeBizNo("T")` 生成租户编码，
 * 补齐 NOT NULL 列与数值状态；返回真实 tenant_id（字符串）而不是 insertId。
 *
 * 归因（S3-144 B/C 定案）：平台侧开租户**不是**邀请码注册的归因宿主（原本也非生产在用通道），
 * `source` 固定 'MANUAL'，本函数不写 t_tenant_attribution。
 */
export async function createTenant(data: {
  tenantName: string;
  contactName: string;
  contactMobile: string;
  contactEmail?: string;
  adminUsername: string;
  adminPassword: string;
  expireAt?: string | null;
}): Promise<string> {
  const tenantId = randomUUID();
  const tenantCode = makeBizNo("T");

  await query(
    `INSERT INTO t_tenant (
       id, tenant_code, name, tenant_name, company_name, company_short_name,
       contact_name, contact_person, contact_mobile, contact_email,
       source, status, expire_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', 1, ?)`,
    [
      tenantId, tenantCode, data.tenantName, data.tenantName, data.tenantName, data.tenantName,
      data.contactName, data.contactName, data.contactMobile, data.contactEmail || "",
      data.expireAt || null,
    ]
  );

  const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

  // t_sys_user.status 是 TINYINT（1=正常），原实现写 'ACTIVE' 字符串在严格模式会 1366 —— 一并按数值落库
  await query(
    `INSERT INTO t_sys_user (tenant_id, username, password_hash, real_name, mobile, status, role)
     VALUES (?, ?, ?, ?, ?, 1, 'ADMIN')`,
    [tenantId, data.adminUsername, hashedPassword, data.contactName, data.contactMobile]
  );

  return tenantId;
}

// ============ 更新租户 ============
export async function updateTenant(id: string, data: {
  tenantName?: string;
  contactName?: string;
  contactMobile?: string;
  contactEmail?: string;
  expireAt?: string | null;
}): Promise<void> {
  const existing = await queryOne<IdRow>("SELECT id FROM t_tenant WHERE id = ?", [id]);
  if (!existing) {
    throw Object.assign(new Error("租户不存在"), { statusCode: 404 });
  }

  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.tenantName !== undefined) { sets.push("tenant_name = ?"); params.push(data.tenantName); }
  if (data.contactName !== undefined) { sets.push("contact_name = ?"); params.push(data.contactName); }
  if (data.contactMobile !== undefined) { sets.push("contact_mobile = ?"); params.push(data.contactMobile); }
  if (data.contactEmail !== undefined) { sets.push("contact_email = ?"); params.push(data.contactEmail); }
  if (data.expireAt !== undefined) { sets.push("expire_at = ?"); params.push(data.expireAt); }

  if (sets.length > 0) {
    params.push(id);
    await query(`UPDATE t_tenant SET ${sets.join(", ")} WHERE id = ?`, params);
  }
}

// ============ 启用/禁用租户 ============
export async function toggleTenantStatus(id: string, status: TenantStatus): Promise<TenantStatus> {
  const statusValue = toTenantStatusValue(status);
  if (statusValue === null) {
    throw new AppError("无效的状态值", 400);
  }

  const raw = await query<{ affectedRows: number }>(
    "UPDATE t_tenant SET status = ? WHERE id = ?",
    [statusValue, id]
  );
  // 真实库（mysql2）写操作返回 ResultSetHeader 对象；mock 模式的 query 统一包成数组 —— 两种都兼容
  const result = (Array.isArray(raw) ? raw[0] : raw) as { affectedRows?: number } | undefined;

  // S3-65 教训：affectedRows=0 不得当成功返回，按「租户不存在」处理
  if (!result || Number(result.affectedRows || 0) === 0) {
    throw new AppError("租户不存在", 404);
  }

  // 回读：以库内真实值为准（不凭入参臆断），出口统一字符串口径
  const row = await queryOne<{ status: number | string | null }>(
    "SELECT status FROM t_tenant WHERE id = ?",
    [id]
  );
  if (!row) {
    throw new AppError("租户不存在", 404);
  }
  return toTenantStatus(row.status);
}
