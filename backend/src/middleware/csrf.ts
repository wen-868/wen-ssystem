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
 *
 * ── S3-196：允许「同一登录态的多个等价主体」──
 * 消费者身份适配层（middleware/consumer-auth.ts）把一个微信登录态解析成**两个**主体：
 *   · 会话主体 = 微信用户 id（登录响应里下发 csrfToken 的那个 id，客户端手上只有它）；
 *   · 业务主体 = 绑定的会员 id（`t_member.id`，消费者端业务数据的归属口径，
 *     见 community-marketing.service.ts「小程序用户 id 即 t_member.id」）。
 * 两者同属**同一个**已认证登录态，故任一主体签出的令牌都应被接受；适配层用
 * `req.csrfSubjectIds` 声明这组主体。不声明时行为与原先逐字一致（只认 req.user.id），
 * 既有商家/平台调用方不受影响。
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
  const subjectIds = (req as { csrfSubjectIds?: number[] }).csrfSubjectIds;
  const accepted = (subjectIds?.length ? subjectIds : [req.user.id]).map((id) =>
    generateCsrfToken(Number(id))
  );

  if (!token || !accepted.includes(String(token))) {
    res.status(403).json(fail("CSRF token 无效或缺失", "403"));
    return;
  }

  next();
};
