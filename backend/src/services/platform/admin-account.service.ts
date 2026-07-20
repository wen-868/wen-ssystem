/**
 * 平台总后台 - 平台管理员服务
 *
 * 功能：平台管理员账号管理
 */

import { query, queryOne } from "../../shared/db";
import bcrypt from "bcryptjs";

// ─── 类型定义 ─────────────────────────────────────────────────

export interface PlatformAdminCreate {
  username: string;
  password: string;
  realName: string;
  phone: string;
  email?: string;
  role: "SUPER_ADMIN" | "ADMIN" | "SUPPORT";
}

// ─── 平台用户管理 ────────────────────────────────────────────

/**
 * 平台管理员列表
 */
export async function listPlatformAdmins(
  page: number,
  pageSize: number,
  filters?: {
    role?: string;
    status?: string;
    keyword?: string;
  }
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filters?.role) {
    conditions.push("role = ?");
    params.push(filters.role);
  }
  if (filters?.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }
  if (filters?.keyword) {
    conditions.push("(username LIKE ? OR real_name LIKE ? OR phone LIKE ?)");
    const like = `%${filters.keyword}%`;
    params.push(like, like, like);
  }

  const where = conditions.join(" AND ");

  const rows = await query<any[]>(
    `SELECT id, username, real_name AS realName, phone, email,
            role, status, last_login_at AS lastLoginAt, created_at AS createdAt
     FROM t_platform_admin
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM t_platform_admin WHERE ${where}`,
    params
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records: rows
  };
}

/**
 * 创建平台管理员
 */
export async function createPlatformAdmin(params: PlatformAdminCreate) {
  const existing = await queryOne<any>(
    "SELECT id FROM t_platform_admin WHERE username = ?",
    [params.username]
  );
  if (existing) {
    throw Object.assign(new Error("用户名已存在"), { statusCode: 400 });
  }

  const passwordHash = await bcrypt.hash(params.password, 10);

  const result = await query<any>(
    `INSERT INTO t_platform_admin
     (username, password_hash, real_name, phone, email, role, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', 'system')`,
    [
      params.username,
      passwordHash,
      params.realName,
      params.phone,
      params.email || null,
      params.role
    ]
  );

  return {
    id: (result as unknown as { insertId: number }).insertId as number,
    username: params.username,
    realName: params.realName,
    role: params.role
  };
}

/**
 * 更新平台管理员状态
 */
export async function updatePlatformAdminStatus(
  adminId: number,
  status: "ACTIVE" | "DISABLED"
) {
  const existing = await queryOne<any>(
    "SELECT id FROM t_platform_admin WHERE id = ?",
    [adminId]
  );
  if (!existing) {
    throw Object.assign(new Error("管理员不存在"), { statusCode: 404 });
  }

  await query(
    "UPDATE t_platform_admin SET status = ? WHERE id = ?",
    [status, adminId]
  );

  return { id: adminId, status };
}