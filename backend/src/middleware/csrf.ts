import type { RequestHandler } from "express";
import { createHmac } from "crypto";
import { env } from "../shared/env";
import { fail } from "../shared/response";

// 放行的 HTTP 方法（不需要 CSRF 校验）
const SAFE_METHODS = ["GET", "OPTIONS", "HEAD"];

/**
 * 基于 userId + CSRF_SECRET 生成 CSRF token（HMAC-SHA256）
 * @param userId 用户 ID
 * @returns HMAC-SHA256 十六进制字符串
 */
export function generateCsrfToken(userId: number): string {
  // 优先使用 CSRF_SECRET，未配置时回退到 JWT_SECRET，确保向后兼容
  const secret = env.CSRF_SECRET || env.JWT_SECRET;
  if (!secret) throw new Error("CSRF_SECRET 或 JWT_SECRET 必须配置");
  return createHmac("sha256", secret)
    .update(String(userId))
    .digest("hex");
}

/**
 * CSRF 防护中间件
 *
 * - GET/OPTIONS/HEAD 方法直接放行
 * - POST/PUT/DELETE 方法校验请求头 x-csrf-token
 * - 从 req.headers 读取 token，与 req.user.id 生成的 HMAC 值比较
 * - 使用 env.CSRF_SECRET 作为 HMAC 密钥
 *
 * 需在认证中间件之后注册，以确保 req.user 已被设置
 */
export const csrfMiddleware: RequestHandler = (req, res, next) => {
  // 安全方法直接放行
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  // 未认证用户直接放行（由认证中间件处理 401）
  if (!req.user) {
    return next();
  }

  const token = req.headers["x-csrf-token"];
  const expectedToken = generateCsrfToken(req.user.id);

  if (!token || token !== expectedToken) {
    res.status(403).json(fail("CSRF token 无效或缺失", "403"));
    return;
  }

  next();
};
