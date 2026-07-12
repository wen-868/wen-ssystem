import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../shared/env";
import { fail } from "../shared/response";

declare const Buffer: any;

export function requireWxAuth(req: any, res: any, next: any) {
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

export async function code2Session(code: string): Promise<{ openid: string; session_key: string; unionid?: string }> {
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

export function aesDecrypt(encryptedData: string, iv: string, sessionKey: string): string {
  const sessionKeyBuf = Buffer.from(sessionKey, "base64");
  const encryptedBuf = Buffer.from(encryptedData, "base64");
  const ivBuf = Buffer.from(iv, "base64");

  const decipher = crypto.createDecipheriv("aes-128-cbc", sessionKeyBuf, ivBuf);
  let decrypted = decipher.update(encryptedBuf as any, undefined as any, "utf8") as any;
  decrypted = (decrypted + decipher.final("utf8")) as string;
  return decrypted;
}

export function signWxToken(wxUserId: number, openid: string): string {
  return jwt.sign({ wxUserId, openid }, env.JWT_SECRET, { expiresIn: "7d" });
}
