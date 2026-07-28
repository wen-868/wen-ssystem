import { queryOne, query } from "../../shared/db";
import { hashPassword, verifyPassword, validatePassword } from "../../shared/password";
import { signPlatformToken } from "../../middleware/auth";
import { generateCsrfToken } from "../../middleware/csrf";
import { AppError } from "../../shared/app-error";
import type { ResultSetHeader } from "mysql2";

// ==================== 类型定义 ====================

/** 平台管理员登录行 */
interface PlatformAdminLoginRow {
  id: number;
  username: string;
  password_hash: string;
  real_name: string;
}

/** 平台管理员信息行 */
interface PlatformAdminRow {
  id: number;
  username: string;
  real_name: string;
}

/** 用户名存在性检查行 */
interface PlatformAdminExistRow {
  id: number;
}

/** INSERT 返回结果 */
interface InsertResult extends ResultSetHeader { }

function getStringOrDefault(value: unknown, defaultValue: string): string {
  return value ? String(value) : defaultValue;
}

function checkRequired(fields: Record<string, unknown>, names: string[]): string | null {
  for (const name of names) {
    if (!fields[name]) return name;
  }
  return null;
}

export async function login(username: string, password: string) {
  const missing = checkRequired({ username, password }, ["username", "password"]);
  if (missing) throw new AppError(`缺少必填字段: ${missing}`, 400);

  const admin = await queryOne<PlatformAdminLoginRow>(
    "SELECT id, username, password_hash, real_name FROM t_platform_admin WHERE username = ? AND status = 1",
    [username]
  );

  if (!admin || !(await verifyPassword(password, admin.password_hash))) {
    throw new AppError("用户名或密码错误", 401);
  }

  const token = signPlatformToken({
    id: admin.id,
    username: admin.username,
    realName: admin.real_name,
    type: "platform_admin",
  });

  // 下发 CSRF token，saas-admin 写操作需注入 x-csrf-token header（与 admin-web 保持一致）
  return { token, admin: { id: admin.id, username: admin.username, realName: admin.real_name }, csrfToken: generateCsrfToken(admin.id) };
}

export async function getMe(adminId: number) {
  const admin = await queryOne<PlatformAdminRow>(
    "SELECT id, username, real_name FROM t_platform_admin WHERE id = ?",
    [adminId]
  );
  if (!admin) throw new AppError("管理员不存在", 404);
  // /me 接口同步下发 csrfToken，便于前端刷新页面后重新获取
  return { id: admin.id, username: admin.username, realName: admin.real_name, csrfToken: generateCsrfToken(admin.id) };
}

export async function createAdmin(data: {
  username: string;
  password: string;
  realName: string;
  email?: string;
  phone?: string;
  role?: string;
}) {
  const missing = checkRequired(data, ["username", "password", "realName"]);
  if (missing) throw new AppError(`缺少必填字段: ${missing}`, 400);

  const validation = validatePassword(data.password);
  if (!validation.valid) {
    throw new AppError(`密码不符合要求：${validation.errors.join("；")}`, 400);
  }

  const existing = await queryOne<PlatformAdminExistRow>("SELECT id FROM t_platform_admin WHERE username = ?", [data.username]);
  if (existing) throw new AppError("用户名已存在", 400);

  const passwordHash = await hashPassword(data.password);

  const result = await query<InsertResult>(
    "INSERT INTO t_platform_admin (username, password_hash, real_name, email, phone, role) VALUES (?, ?, ?, ?, ?, ?)",
    [
      data.username,
      passwordHash,
      data.realName,
      getStringOrDefault(data.email, ""),
      getStringOrDefault(data.phone, ""),
      getStringOrDefault(data.role, "PLATFORM_ADMIN"),
    ]
  );

  const adminId = (result as unknown as ResultSetHeader).insertId;
  return { id: adminId, username: data.username, realName: data.realName, message: "创建成功" };
}
