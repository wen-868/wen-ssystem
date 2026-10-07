import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePlatformAuth } from "../middleware/auth";
import { csrfMiddleware } from "../middleware/csrf";
import { requireCaptcha } from "../middleware/captcha-guard";
import { loginFailLimiters, captchaFailLimiters } from "../middleware/login-fail-limiter";
import {
  platformLogin,
  getPlatformMe,
  createPlatformAdmin,
  getCaptcha,
  getPlatformMfaStatus,
  setupPlatformMfa,
  confirmPlatformMfa,
  disablePlatformMfa,
  verifyPlatformMfa,
} from "../controllers/platform/platform-auth.controller";

export const platformAuthRouter = Router();

// 图形验证码下发（R101-S2-01 裁定 4.1）：公开接口，仅允许 GET（csrfMiddleware 对安全方法放行）
platformAuthRouter.get("/captcha", asyncHandler(getCaptcha));
// 登录：限流按失败类型**分两条独立通道**（批 2.2 裁定③），再校验图形验证码。
//
//   [验证码弱限流] → [凭据限流] → requireCaptcha → handler
//    只计 400        只计 401
//
// 两条 limiter 各自通过 `requestWasSuccessful` 只统计自己关心的状态码，
// 所以互不干扰：验证码填错不会消耗凭据额度（更不会锁账号），
// 密码输错也不会消耗验证码额度。顺序上把弱限流放最外层，
// 让「疯狂试验证码」先被 IP 维度拦住。
// S3-58-F1 R2：凭据通道的**账号维度主键已改为 (账号 + 归一化 IP)**，
// 并另挂账号维度高阈值兜底（60 次/小时）拦分布式爆破——详见 middleware/login-fail-limiter.ts。
// 校验逻辑全部由中间件承担，controller 与 service 签名不变。
platformAuthRouter.post(
  "/login",
  ...captchaFailLimiters.all,
  ...loginFailLimiters.all,
  requireCaptcha,
  asyncHandler(platformLogin)
);
platformAuthRouter.get("/me", requirePlatformAuth, asyncHandler(getPlatformMe));
// 写操作接口需挂载 csrfMiddleware（routeConfig.auth="none"，auto-routes 不会附加）
platformAuthRouter.post("/admin/create", requirePlatformAuth, csrfMiddleware, asyncHandler(createPlatformAdmin));

// ── 平台管理员双因素认证（MFA，S3-58-F1 R3，默认不强制）──
// 登录二次验证的爆破面：挑战令牌 TTL 5 分钟、动态码仅 6 位数字，
// 与租户侧 `/api/admin/auth/mfa/verify` 挂 storeLoginLimiter 同范式，这里给 IP 维度限流。
// 按踩坑 [S3-112] 的教训，`rateLimit(...)` 必须**内联在本注册点**（包成 helper 会让 CodeQL 识别不到限流）。
const platformMfaVerifyLimiter = rateLimit({
  windowMs: 5 * 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // 只统计「动态码错误（400）」：验证成功不消耗额度（与验证码通道同口径）
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res) => res.statusCode !== 400,
  message: () => ({ code: "429", msg: "动态验证码错误次数过多，请重新登录后再试", traceId: "" }),
  validate: { trustProxy: false, xForwardedForHeader: false },
});
// 四件套的管理操作限流：CodeQL `js/missing-rate-limiting` 要求「做了鉴权的路由必须限流」
//   （PR #273 首跑即因此报 4 条 high）。这里是已登录管理员的自助操作，正常使用远低于阈值，
//   按 IP 维度 60 次 / 5 分钟兜底，防「拿到令牌后狂打 setup/confirm/disable」。
const platformMfaManageLimiter = rateLimit({
  windowMs: 5 * 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: () => ({ code: "429", msg: "操作过于频繁，请稍后再试", traceId: "" }),
  validate: { trustProxy: false, xForwardedForHeader: false },
});
// 四件套需要平台鉴权；写操作（setup/confirm/disable）额外过 CSRF
platformAuthRouter.get("/mfa/status", platformMfaManageLimiter, requirePlatformAuth, asyncHandler(getPlatformMfaStatus));
platformAuthRouter.post("/mfa/setup", platformMfaManageLimiter, requirePlatformAuth, csrfMiddleware, asyncHandler(setupPlatformMfa));
platformAuthRouter.post("/mfa/confirm", platformMfaManageLimiter, requirePlatformAuth, csrfMiddleware, asyncHandler(confirmPlatformMfa));
platformAuthRouter.post("/mfa/disable", platformMfaManageLimiter, requirePlatformAuth, csrfMiddleware, asyncHandler(disablePlatformMfa));
// 登录二次验证：无鉴权（凭短时效挑战令牌），独立限流防爆破
platformAuthRouter.post("/mfa/verify", platformMfaVerifyLimiter, asyncHandler(verifyPlatformMfa));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/auth",
  router: platformAuthRouter,
  auth: "none",
};
