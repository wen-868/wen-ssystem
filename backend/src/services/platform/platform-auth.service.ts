import { queryOne, query } from "../../shared/db";
import { hashPassword, verifyPassword, validatePassword } from "../../shared/password";
import { signPlatformToken } from "../../middleware/auth";
import { AppError } from "../../shared/app-error";

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

  const admin = await queryOne<any>(
    "SELECT id, username, password, real_name FROM t_platform_admin WHERE username = ? AND status = 1",
    [username]
  );

  if (!admin || !(await verifyPassword(password, admin.password))) {
    throw new AppError("用户名或密码错误", 401);
  }

  const token = signPlatformToken({
    id: admin.id,
    username: admin.username,
    realName: admin.real_name,
    type: "platform_admin",
  });

  return { token, admin: { id: admin.id, username: admin.username, realName: admin.real_name } };
}

export async function getMe(adminId: number) {
  const admin = await queryOne<any>(
    "SELECT id, username, real_name FROM t_platform_admin WHERE id = ?",
    [adminId]
  );
  if (!admin) throw new AppError("管理员不存在", 404);
  return { id: admin.id, username: admin.username, realName: admin.real_name };
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

  const existing = await queryOne<any>("SELECT id FROM t_platform_admin WHERE username = ?", [data.username]);
  if (existing) throw new AppError("用户名已存在", 400);

  const passwordHash = await hashPassword(data.password);

  const result = await query<any>(
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

  const adminId = (result as unknown as { insertId: number }).insertId;
  return { id: adminId, username: data.username, realName: data.realName, message: "创建成功" };
}
