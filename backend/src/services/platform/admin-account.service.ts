/**
 * 平台总后台 - 平台管理员服务
 *
 * 功能：平台管理员账号管理
 */

import { query, queryOne } from "../../shared/db";
import bcrypt from "bcryptjs";
import type { ResultSetHeader } from "mysql2";
import { randomInt } from "node:crypto";
import { insertPlatformAuditLog } from "../admin/platform-audit-log.service";

// ─── 类型定义 ─────────────────────────────────────────────────

export interface PlatformAdminCreate {
  username: string;
  password: string;
  realName: string;
  phone: string;
  email?: string;
  role: "SUPER_ADMIN" | "ADMIN" | "SUPPORT";
}

/** 平台管理员列表行 */
interface PlatformAdminListRow {
  id: number;
  username: string;
  realName: string;
  phone: string;
  email: string | null;
  role: string;
  status: number;
  lastLoginAt: Date | string | null;
  createdAt: Date | string;
}

/** 总数行 */
interface CountRow {
  total: number;
}

/** ID存在性检查行 */
interface IdRow {
  id: number;
}

/** INSERT 返回结果 */
interface InsertResult extends ResultSetHeader { }

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

  const rows = await query<PlatformAdminListRow>(
    `SELECT id, username, real_name AS realName, phone, email,
            role, status, last_login_at AS lastLoginAt, created_at AS createdAt
     FROM t_platform_admin
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<CountRow>(
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
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_platform_admin WHERE username = ?",
    [params.username]
  );
  if (existing) {
    throw Object.assign(new Error("用户名已存在"), { statusCode: 400 });
  }

  const passwordHash = await bcrypt.hash(params.password, 10);

  const result = await query<InsertResult>(
    `INSERT INTO t_platform_admin
     (username, password_hash, real_name, phone, email, role, status)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
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
    id: (result as unknown as ResultSetHeader).insertId,
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
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_platform_admin WHERE id = ?",
    [adminId]
  );
  if (!existing) {
    throw Object.assign(new Error("管理员不存在"), { statusCode: 404 });
  }

  // 表结构 status 是 TINYINT(1=启用 0=禁用)，将字符串映射为数字
  const statusValue = status === "ACTIVE" ? 1 : 0;
  await query(
    "UPDATE t_platform_admin SET status = ? WHERE id = ?",
    [statusValue, adminId]
  );

  return { id: adminId, status };
}

// ─── C6-1A：平台管理员建号 / 重置密码（零 DDL，复用 t_platform_admin） ──────────

/**
 * 操作人上下文（写 t_platform_audit_log 留痕用）
 *
 * 来源：requirePlatformAuth 解出的 req.user（middleware/auth.ts:147），
 * 控制器负责从 req 取出后传入，服务层不再依赖 req。
 */
export interface PlatformAdminOperator {
  adminId: number;
  adminName: string;
  ip?: string | null;
}

/** 初始口令字符集：去掉 0/O/1/l/I 等易混字符，便于页面一次性抄录 */
const INITIAL_PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const INITIAL_PASSWORD_LENGTH = 12;

/**
 * 生成初始口令（服务端生成，只在创建/重置响应里返回一次）
 *
 * 依据：凌舟裁定 C6-0-R6「不发邮件短信：建号 + 生成初始口令 + 页面一次性展示，重置同理」。
 * 因此本函数产出的明文口令**只在响应体出现一次**，不落库、不进日志、不进审计明细。
 */
function generateInitialPassword(): string {
  let out = "";
  for (let i = 0; i < INITIAL_PASSWORD_LENGTH; i += 1) {
    out += INITIAL_PASSWORD_ALPHABET[randomInt(INITIAL_PASSWORD_ALPHABET.length)];
  }
  return out;
}

/**
 * 建号（「邀请」的落地实现，零 DDL）
 *
 * 与「邀请」的差别：不发邮件/短信（裁定 R6），由服务端生成初始口令随响应返回一次，
 * 由页面一次性展示给操作人转达。其余建号逻辑完全复用 `createPlatformAdmin`，
 * 不重写既有实现（避免两套建号口径）。
 */
export async function invitePlatformAdmin(
  params: Omit<PlatformAdminCreate, "password">,
  operator: PlatformAdminOperator
) {
  const initialPassword = generateInitialPassword();
  const created = await createPlatformAdmin({ ...params, password: initialPassword });

  await insertPlatformAuditLog({
    adminId: operator.adminId,
    adminName: operator.adminName,
    module: "platform_admin",
    action: "CREATE_ADMIN",
    auditType: "CREATE_ADMIN",
    description: `新建平台管理员账号 ${created.username}（角色 ${created.role}）`,
    targetType: "platform_admin",
    targetId: created.id,
    // 审计明细留痕**不含口令**（明文口令只在响应体一次性展示）
    detail: { username: created.username, role: created.role, chargeMethod: "initial_password_once" },
    ip: operator.ip ?? null
  });

  return { ...created, initialPassword, passwordShownOnce: true };
}

/**
 * 重置平台管理员密码（零 DDL：UPDATE t_platform_admin.password_hash）
 *
 * 同 R6：不发信，新口令随响应返回一次；写审计留痕（不含口令）。
 */
export async function resetPlatformAdminPassword(
  adminId: number,
  operator: PlatformAdminOperator
) {
  const existing = await queryOne<{ id: number; username: string; realName: string }>(
    `SELECT id, username, real_name AS realName FROM t_platform_admin WHERE id = ?`,
    [adminId]
  );
  if (!existing) {
    throw Object.assign(new Error("管理员不存在"), { statusCode: 404 });
  }

  const initialPassword = generateInitialPassword();
  const passwordHash = await bcrypt.hash(initialPassword, 10);
  await query(
    "UPDATE t_platform_admin SET password_hash = ?, updated_at = NOW() WHERE id = ?",
    [passwordHash, adminId]
  );

  await insertPlatformAuditLog({
    adminId: operator.adminId,
    adminName: operator.adminName,
    module: "platform_admin",
    action: "RESET_ADMIN_PASSWORD",
    auditType: "RESET_ADMIN_PASSWORD",
    description: `重置平台管理员 ${existing.username} 的密码（新口令一次性展示）`,
    targetType: "platform_admin",
    targetId: adminId,
    detail: { username: existing.username, chargeMethod: "initial_password_once" },
    ip: operator.ip ?? null
  });

  return {
    id: adminId,
    username: existing.username,
    realName: existing.realName,
    initialPassword,
    passwordShownOnce: true
  };
}
