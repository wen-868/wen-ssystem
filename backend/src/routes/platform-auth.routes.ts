import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { queryOne } from "../shared/db.js";
import { env } from "../shared/env.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { ok, fail } from "../shared/response.js";
import { requirePlatformAuth } from "../middleware/auth.js";

export const platformAuthRouter = Router();

// POST /api/platform/auth/login - 平台管理员登录
platformAuthRouter.post("/login", asyncHandler(async (req: any, res: any) => {
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
}));

// GET /api/platform/auth/me - 获取当前管理员信息
platformAuthRouter.get("/me", requirePlatformAuth, asyncHandler(async (req: any, res: any) => {
  const admin = await queryOne<any>(
    "SELECT id, username, real_name FROM platform_admin WHERE id = ?",
    [req.user.id]
  );
  if (!admin) {
    res.status(404).json(fail("管理员不存在", "404"));
    return;
  }
  res.json(ok({ id: admin.id, username: admin.username, realName: admin.real_name }));
}));