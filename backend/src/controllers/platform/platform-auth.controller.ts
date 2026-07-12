import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { queryOne, query } from "../../shared/db";
import { env } from "../../shared/env";
import { ok, fail } from "../../shared/response";
import { hashPassword, validatePassword } from "../../shared/password";

export async function platformLogin(req: any, res: any) {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json(fail("用户名和密码不能为空", "400"));
    return;
  }

  const admin = await queryOne<any>(
    "SELECT id, username, password, real_name FROM platform_admin WHERE username = ? AND status = 1",
    [username]
  );

  if (!admin || !(await bcrypt.compare(password, admin.password))) {
    res.status(401).json(fail("用户名或密码错误", "401"));
    return;
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username, realName: admin.real_name, type: "platform_admin" },
    env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json(ok({ token, admin: { id: admin.id, username: admin.username, realName: admin.real_name } }));
}

export async function getPlatformMe(req: any, res: any) {
  const admin = await queryOne<any>(
    "SELECT id, username, real_name FROM platform_admin WHERE id = ?",
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

  if (!username || !password || !realName) {
    res.status(400).json(fail("用户名、密码、真实姓名不能为空", "400"));
    return;
  }

  const validation = validatePassword(password);
  if (!validation.valid) {
    res.status(400).json(fail(`密码不符合要求：${validation.errors.join("；")}`, "400"));
    return;
  }

  const existing = await queryOne<any>("SELECT id FROM platform_admin WHERE username = ?", [username]);
  if (existing) {
    res.status(400).json(fail("用户名已存在", "400"));
    return;
  }

  const passwordHash = await hashPassword(password);

  const result = await query<any>(
    "INSERT INTO platform_admin (username, password_hash, real_name, email, phone, role) VALUES (?, ?, ?, ?, ?, ?)",
    [username, passwordHash, realName, email || "", phone || "", role || "PLATFORM_ADMIN"]
  );

  const adminId = (result as unknown as { insertId: number }).insertId;
  res.json(ok({ id: adminId, username, realName, message: "创建成功" }));
}
