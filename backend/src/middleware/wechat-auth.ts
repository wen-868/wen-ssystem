import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../shared/env";
import { fail } from "../shared/response";
import { fetchWithRetry } from "../shared/http-with-retry";
import type { AuthUser } from "./auth";

declare const Buffer: any;

export function requireWxAuth(req: any, res: any, next: any) {
  const authorization = req.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json(fail("未登录", "401"));
    return;
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { wxUserId: number; openid: string; tenantId?: string };
    req.wxUser = { id: decoded.wxUserId, openid: decoded.openid };
    // ── S3-187 E（已裁定方案 A）──────────────────────────────────────────────
    // 原实现只设 req.wxUser、**不设 req.user**；而 csrfMiddleware 在 `!req.user` 时直接放行
    // （middleware/csrf.ts:39-42）⇒ 给 wechat 的写端点挂 CSRF 是「假安全」。此处认证通过后
    // 补一个**最小可用**的登录态（id 用微信用户 id，即 CSRF 令牌的绑定对象；roles 为空，
    // 不带来任何额外授权），并补 req.tenantId（下游 wechat.controller.bind 会读它）。
    // 调用方仍须保证「认证在前、CSRF 在后」。
    // 租户来源：签发时写入令牌的 tenantId 优先，其次请求头 X-Tenant-Id（多端既有约定，
    // 见 app-mobile/src/api/request.ts:78）。两者都缺时不伪造，保持未设置 ⇒ 需要租户的
    // 操作（bind）仍按既有口径失败，不会被静默当成某个租户。
    const tenantId = decoded.tenantId || (req.headers["x-tenant-id"] as string) || "";
    req.user = {
      id: decoded.wxUserId,
      username: `wx_${decoded.openid}`,
      roles: [],
      storeId: null,
      tenantId,
    } as AuthUser;
    if (tenantId) req.tenantId = tenantId;
    next();
  } catch {
    res.status(401).json(fail("登录已失效", "401"));
  }
}

export async function code2Session(code: string): Promise<{ openid: string; session_key: string; unionid?: string }> {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${env.WX_APPID}&secret=${env.WX_APP_SECRET}&js_code=${code}&grant_type=authorization_code`;
  const res = await fetchWithRetry(url, {}, { timeoutMs: 10_000, retries: 1, backoffMs: 500 });
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
