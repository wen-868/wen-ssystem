import { Router } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { env } from "../shared/env.js";
import { ok, fail } from "../shared/response.js";
import { verifyPassword } from "../shared/password.js";

export const wechatRouter = Router();

// ==================== 微信小程序用户类型声明 ====================
declare global {
  namespace Express {
    interface Request {
      wxUser?: {
        id: number;
        openid: string;
      };
    }
  }
}

// ==================== 微信JWT中间件 ====================
function requireWxAuth(req: any, res: any, next: any) {
  const authorization = req.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json(fail("未登录", "401"));
    return;
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { wxUserId: number; openid: string };
    req.wxUser = { id: decoded.wxUserId, openid: decoded.openid };
    next();
  } catch {
    res.status(401).json(fail("登录已失效", "401"));
  }
}

// ==================== 辅助函数 ====================

/** 调用微信 code2Session 接口获取 openid 和 session_key */
async function code2Session(code: string): Promise<{ openid: string; session_key: string; unionid?: string }> {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${env.WX_APPID}&secret=${env.WX_APP_SECRET}&js_code=${code}&grant_type=authorization_code`;
  const res = await fetch(url);
  const data = await res.json() as Record<string, string>;
  if (data.errcode && data.errcode !== "0") {
    throw new Error(`微信code2Session失败: ${data.errcode} ${data.errmsg}`);
  }
  return {
    openid: data.openid,
    session_key: data.session_key,
    unionid: data.unionid || undefined,
  };
}

/** AES-128-CBC 解密微信加密数据 */
function aesDecrypt(encryptedData: string, iv: string, sessionKey: string): string {
  const sessionKeyBuf = Buffer.from(sessionKey, "base64");
  const encryptedBuf = Buffer.from(encryptedData, "base64");
  const ivBuf = Buffer.from(iv, "base64");

  const decipher = crypto.createDecipheriv("aes-128-cbc", sessionKeyBuf, ivBuf);
  let decrypted = decipher.update(encryptedBuf, undefined as any, "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/** 生成微信用户JWT token */
function signWxToken(wxUserId: number, openid: string): string {
  return jwt.sign({ wxUserId, openid }, env.JWT_SECRET, { expiresIn: "7d" });
}

// ==================== 登录接口 ====================

/** POST /auth/login - 微信小程序登录 */
wechatRouter.post("/auth/login", asyncHandler(async (req, res) => {
  const { code } = z.object({ code: z.string().min(1) }).parse(req.body);

  // 调用微信接口获取 openid
  const wxData = await code2Session(code);

  // 查找或创建 wx_user 记录
  const existing = await queryOne<{ id: number }>(
    "SELECT id FROM wx_user WHERE openid = ?",
    [wxData.openid]
  );

  let wxUserId: number;
  if (existing) {
    // 更新 session_key 和最后登录时间
    await query(
      "UPDATE wx_user SET session_key = ?, unionid = ?, last_login_at = NOW() WHERE id = ?",
      [wxData.session_key, wxData.unionid || null, existing.id]
    );
    wxUserId = existing.id;
  } else {
    // 新建微信用户
    const result = await query<{ insertId: number }>(
      "INSERT INTO wx_user (openid, unionid, session_key, last_login_at) VALUES (?, ?, ?, NOW())",
      [wxData.openid, wxData.unionid || null, wxData.session_key]
    );
    wxUserId = result.insertId as unknown as number;
  }

  // 查询用户完整信息
  const userInfo = await queryOne<any>(
    "SELECT id, nickname, avatar_url AS avatarUrl, phone, gender, city, province, country FROM wx_user WHERE id = ?",
    [wxUserId]
  );

  // 生成自定义token
  const token = signWxToken(wxUserId, wxData.openid);

  res.json(ok({
    token,
    userInfo: {
      id: userInfo!.id,
      nickname: userInfo!.nickname || "微信用户",
      avatarUrl: userInfo!.avatarUrl || "",
      phone: userInfo!.phone || "",
    },
  }));
}));

/** POST /auth/decrypt-phone - 解密手机号 */
wechatRouter.post("/auth/decrypt-phone", asyncHandler(async (req, res) => {
  const { encryptedData, iv } = z.object({
    encryptedData: z.string().min(1),
    iv: z.string().min(1),
  }).parse(req.body);

  // 从token中获取wxUser
  const authorization = req.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json(fail("未登录", "401"));
    return;
  }
  const decoded = jwt.verify(token, env.JWT_SECRET) as { wxUserId: number; openid: string };

  // 获取session_key
  const wxUser = await queryOne<{ session_key: string }>(
    "SELECT session_key FROM wx_user WHERE id = ?",
    [decoded.wxUserId]
  );
  if (!wxUser || !wxUser.session_key) {
    res.status(400).json(fail("session_key不存在，请重新登录", "400"));
    return;
  }

  try {
    const decrypted = aesDecrypt(encryptedData, iv, wxUser.session_key);
    const phoneData = JSON.parse(decrypted) as { phoneNumber: string; purePhoneNumber: string; watermark?: any };
    const phone = phoneData.phoneNumber || phoneData.purePhoneNumber;

    // 更新手机号
    await query(
      "UPDATE wx_user SET phone = ? WHERE id = ?",
      [phone, decoded.wxUserId]
    );

    res.json(ok({ phone }));
  } catch (err) {
    res.status(400).json(fail("手机号解密失败，请重试", "400"));
  }
}));

/** POST /auth/update-profile - 更新用户资料 */
wechatRouter.put("/auth/profile", asyncHandler(async (req, res) => {
  const wxUser = (req as any).wxUser;
  if (!wxUser) {
    res.status(401).json(fail("未登录", "401"));
    return;
  }

  const body = z.object({
    nickname: z.string().max(64).optional(),
    avatarUrl: z.string().max(512).optional(),
  }).parse(req.body);

  await query(
    "UPDATE wx_user SET nickname = ?, avatar_url = ? WHERE id = ?",
    [body.nickname || null, body.avatarUrl || null, wxUser.id]
  );

  res.json(ok({ message: "更新成功" }));
}));

/** GET /auth/profile - 获取当前用户信息 */
wechatRouter.get("/auth/profile", requireWxAuth, asyncHandler(async (req, res) => {
  const wxUser = (req as any).wxUser;
  const userInfo = await queryOne<any>(
    `SELECT id, openid, nickname, avatar_url AS avatarUrl, phone, gender, city, province, country,
            last_login_at AS lastLoginAt, created_at AS createdAt
     FROM wx_user WHERE id = ?`,
    [wxUser.id]
  );
  if (!userInfo) {
    res.status(404).json(fail("用户不存在", "404"));
    return;
  }

  // 查询绑定关系
  const bindings = await query<any>(
    `SELECT ub.id, ub.binding_type, ub.status, ub.bound_at,
            su.username, su.real_name AS realName
     FROM user_binding ub
     LEFT JOIN sys_user su ON su.id = ub.system_user_id
     WHERE ub.wx_user_id = ? AND ub.status = 'ACTIVE'`,
    [wxUser.id]
  );

  res.json(ok({ ...userInfo, bindings }));
}));

// ==================== 绑定系统账号 ====================

/** POST /auth/bind - 绑定系统账号 */
wechatRouter.post("/auth/bind", requireWxAuth, asyncHandler(async (req, res) => {
  const wxUser = (req as any).wxUser;
  const body = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
    bindingType: z.enum(["ADMIN", "MERCHANT", "CONSUMER"]),
  }).parse(req.body);

  // 验证系统账号密码
  const sysUser = await queryOne<{ id: number; password_hash: string; username: string; real_name: string }>(
    "SELECT id, password_hash, username, real_name FROM sys_user WHERE username = ? AND status = 1",
    [body.username]
  );
  if (!sysUser) {
    res.status(400).json(fail("账号不存在或已禁用", "400"));
    return;
  }
  if (!verifyPassword(body.password, sysUser.password_hash)) {
    res.status(400).json(fail("密码错误", "400"));
    return;
  }

  // 检查是否已绑定
  const existingBinding = await queryOne<{ id: number }>(
    "SELECT id FROM user_binding WHERE wx_user_id = ? AND system_user_id = ? AND status = 'ACTIVE'",
    [wxUser.id, sysUser.id]
  );
  if (existingBinding) {
    res.status(400).json(fail("该账号已绑定", "400"));
    return;
  }

  // 创建绑定关系
  await query(
    "INSERT INTO user_binding (wx_user_id, system_user_id, binding_type, status) VALUES (?, ?, ?, 'ACTIVE')",
    [wxUser.id, sysUser.id, body.bindingType]
  );

  res.json(ok({
    bindingType: body.bindingType,
    systemUser: {
      id: sysUser.id,
      username: sysUser.username,
      realName: sysUser.real_name,
    },
  }));
}));

/** POST /auth/unbind - 解除绑定 */
wechatRouter.post("/auth/unbind", requireWxAuth, asyncHandler(async (req, res) => {
  const wxUser = (req as any).wxUser;
  const body = z.object({
    systemUserId: z.number().int().positive(),
  }).parse(req.body);

  const result = await query<any>(
    "UPDATE user_binding SET status = 'UNBOUND', unbound_at = NOW() WHERE wx_user_id = ? AND system_user_id = ? AND status = 'ACTIVE'",
    [wxUser.id, body.systemUserId]
  );

  if ((result as any).affectedRows === 0) {
    res.status(400).json(fail("未找到有效绑定关系", "400"));
    return;
  }

  res.json(ok({ message: "解绑成功" }));
}));
