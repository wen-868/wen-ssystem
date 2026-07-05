import { query, queryOne } from "../shared/db.js";
import bcrypt from "bcryptjs";

export interface TenantRecord {
  id: number;
  tenantName: string;
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

// ============ 租户列表 ============
export async function listTenants(page: number, pageSize: number, keyword?: string): Promise<TenantListResult> {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: any[] = [];

  if (keyword) {
    conditions.push("tenant_name LIKE ?");
    params.push(`%${keyword}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [totalResult, records] = await Promise.all([
    queryOne<any>(`SELECT COUNT(*) AS total FROM tenant ${where}`, params),
    query<any>(
      `SELECT id, tenant_name AS tenantName, contact_name AS contactName,
              contact_mobile AS contactMobile, contact_email AS contactEmail,
              status, expire_at AS expireAt, created_at AS createdAt
       FROM tenant ${where}
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
    `SELECT id, tenant_name AS tenantName, contact_name AS contactName,
            contact_mobile AS contactMobile, contact_email AS contactEmail,
            status, expire_at AS expireAt, created_at AS createdAt
     FROM tenant WHERE id = ?`,
    [id]
  );
}

// ============ 检查租户名重复 ============
export async function checkTenantNameExists(name: string): Promise<boolean> {
  const existing = await queryOne<any>("SELECT id FROM tenant WHERE tenant_name = ?", [name]);
  return !!existing;
}

// ============ 创建租户（含管理员） ============
export async function createTenant(data: {
  tenantName: string;
  contactName: string;
  contactMobile: string;
  contactEmail?: string;
  adminUsername: string;
  adminPassword: string;
  expireAt?: string | null;
}): Promise<number> {
  const result = await query<any>(
    `INSERT INTO tenant (tenant_name, contact_name, contact_mobile, contact_email, status, expire_at)
     VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
    [data.tenantName, data.contactName, data.contactMobile, data.contactEmail || "", data.expireAt || null]
  );

  const tenantId = (result as unknown as { insertId: number }).insertId;
  const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

  await query(
    `INSERT INTO sys_user (tenant_id, username, password_hash, real_name, mobile, status, role)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE', 'ADMIN')`,
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
  const existing = await queryOne<any>("SELECT id FROM tenant WHERE id = ?", [id]);
  if (!existing) {
    throw Object.assign(new Error("租户不存在"), { statusCode: 404 });
  }

  const sets: string[] = [];
  const params: any[] = [];

  if (data.tenantName !== undefined) { sets.push("tenant_name = ?"); params.push(data.tenantName); }
  if (data.contactName !== undefined) { sets.push("contact_name = ?"); params.push(data.contactName); }
  if (data.contactMobile !== undefined) { sets.push("contact_mobile = ?"); params.push(data.contactMobile); }
  if (data.contactEmail !== undefined) { sets.push("contact_email = ?"); params.push(data.contactEmail); }
  if (data.expireAt !== undefined) { sets.push("expire_at = ?"); params.push(data.expireAt); }

  if (sets.length > 0) {
    params.push(id);
    await query(`UPDATE tenant SET ${sets.join(", ")} WHERE id = ?`, params);
  }
}

// ============ 启用/禁用租户 ============
export async function toggleTenantStatus(id: number, status: string): Promise<void> {
  await query("UPDATE tenant SET status = ? WHERE id = ?", [status, id]);
}