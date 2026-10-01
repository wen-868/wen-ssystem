import { randomUUID } from "node:crypto";
import { query, queryOne } from "../shared/db";
import { makeBizNo } from "../shared/id";
import bcrypt from "bcryptjs";

export interface TenantRecord {
  id: number;
  tenantName: string;
  tenantCode: string;
  contactName: string;
  contactMobile: string;
  contactEmail: string;
  status: string;
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
  id: number;
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

  const [totalResult, records] = await Promise.all([
    queryOne<CountTotalRow>(`SELECT COUNT(*) AS total FROM t_tenant ${where}`, params),
    query<TenantRecord>(
      `SELECT id, tenant_code AS tenantCode, tenant_name AS tenantName, contact_name AS contactName,
              contact_mobile AS contactMobile, contact_email AS contactEmail,
              status, expire_at AS expireAt, created_at AS createdAt
       FROM t_tenant ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    ),
  ]);

  return { total: totalResult?.total || 0, page, pageSize, records };
}

// ============ 租户详情 ============
export async function getTenantById(id: number): Promise<TenantRecord | null> {
  return queryOne<TenantRecord>(
    `SELECT id, tenant_code AS tenantCode, tenant_name AS tenantName, contact_name AS contactName,
            contact_mobile AS contactMobile, contact_email AS contactEmail,
            status, expire_at AS expireAt, created_at AS createdAt
     FROM t_tenant WHERE id = ?`,
    [id]
  );
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
export async function updateTenant(id: number, data: {
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
export async function toggleTenantStatus(id: number, status: string): Promise<void> {
  await query("UPDATE t_tenant SET status = ? WHERE id = ?", [status, id]);
}
