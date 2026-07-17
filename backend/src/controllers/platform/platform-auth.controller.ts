import bcrypt from "bcryptjs";
import { queryOne, query } from "../../shared/db";
import { ok, fail } from "../../shared/response";
import { hashPassword, validatePassword } from "../../shared/password";
import { signPlatformToken } from "../../middleware/auth";

// ── 辅助函数（集中分支逻辑，减少重复分支统计） ──

/** 获取字符串值，无值时返回默认值 */
function getStringOrDefault(value: unknown, defaultValue: string): string {
  return value ? String(value) : defaultValue;
}

/** 检查必填字段，返回缺失的字段名或 null */
function checkRequired(fields: Record<string, unknown>, names: string[]): string | null {
  for (const name of names) {
    if (!fields[name]) return name;
  }
  return null;
}

export async function platformLogin(req: any, res: any) {
  const { username, password } = req.body;
  const missing = checkRequired({ username, password }, ["username", "password"]);
  if (missing) {
    res.status(400).json(fail("用户名和密码不能为空", "400"));
    return;
  }

  const admin = await queryOne<any>(
    "SELECT id, username, password, real_name FROM t_platform_admin WHERE username = ? AND status = 1",
    [username]
  );

  if (!admin || !(await bcrypt.compare(password, admin.password))) {
    res.status(401).json(fail("用户名或密码错误", "401"));
    return;
  }

  // 使用平台专用 issuer/audience 签发 JWT，与商家 JWT 严格隔离
  // 平台 JWT: issuer=zhixiang-platform, audience=zhixiang-platform-client
  // 商家 JWT: issuer=zhixiang-system,  audience=zhixiang-client
  const token = signPlatformToken({
    id: admin.id,
    username: admin.username,
    realName: admin.real_name,
    type: "platform_admin",
  });

  res.json(ok({ token, admin: { id: admin.id, username: admin.username, realName: admin.real_name } }));
}

export async function getPlatformMe(req: any, res: any) {
  const admin = await queryOne<any>(
    "SELECT id, username, real_name FROM t_platform_admin WHERE id = ?",
    [req.user.id]
  );
  if (!admin) {
    res.status(404).json(fail("管理员不存在", "404"));
    return;
  }
  res.json(ok({ id: admin.id, username: admin.username, realName: admin.real_name }));
}

export async function createPlatformAdmin(req: any, res: any) {
  const { username, password, realName, email, phone, role } = req.body;

  const missing = checkRequired({ username, password, realName }, ["username", "password", "realName"]);
  if (missing) {
    res.status(400).json(fail("用户名、密码、真实姓名不能为空", "400"));
    return;
  }

  const validation = validatePassword(password);
  if (!validation.valid) {
    res.status(400).json(fail(`密码不符合要求：${validation.errors.join("；")}`, "400"));
    return;
  }

  const existing = await queryOne<any>("SELECT id FROM t_platform_admin WHERE username = ?", [username]);
  if (existing) {
    res.status(400).json(fail("用户名已存在", "400"));
    return;
  }

  const passwordHash = await hashPassword(password);

  const result = await query<any>(
    "INSERT INTO t_platform_admin (username, password_hash, real_name, email, phone, role) VALUES (?, ?, ?, ?, ?, ?)",
    [username, passwordHash, realName, getStringOrDefault(email, ""), getStringOrDefault(phone, ""), getStringOrDefault(role, "PLATFORM_ADMIN")]
  );

  const adminId = (result as unknown as { insertId: number }).insertId;
  res.json(ok({ id: adminId, username, realName, message: "创建成功" }));
}
