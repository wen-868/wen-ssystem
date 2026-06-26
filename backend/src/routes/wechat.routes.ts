import { Router } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { asyncHandler } from "../shared/async-handler.js";
import { env } from "../shared/env.js";
import { ok, fail } from "../shared/response.js";
import { createWechatController } from "../controllers/wechat.controller.js";

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

const ctrl = createWechatController(code2Session, aesDecrypt, signWxToken);

// ==================== 登录接口 ====================
wechatRouter.post("/auth/login", ctrl.login);

// ==================== 解密手机号 ====================
wechatRouter.post("/auth/decrypt-phone", ctrl.decryptPhone);

// ==================== 更新用户资料 ====================
wechatRouter.put("/auth/profile", ctrl.updateProfile);

// ==================== 获取当前用户信息 ====================
wechatRouter.get("/auth/profile", requireWxAuth, ctrl.getProfile);

// ==================== 绑定系统账号 ====================
wechatRouter.post("/auth/bind", requireWxAuth, ctrl.bind);

// ==================== 解除绑定 ====================
wechatRouter.post("/auth/unbind", requireWxAuth, ctrl.unbind);