import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePlatformAuth } from "../middleware/auth";
import { csrfMiddleware } from "../middleware/csrf";
import { requireCaptcha } from "../middleware/captcha-guard";
import { loginFailLimiters, captchaFailLimiters } from "../middleware/login-fail-limiter";
import { platformLogin, getPlatformMe, createPlatformAdmin, getCaptcha } from "../controllers/platform/platform-auth.controller";

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

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/auth",
  router: platformAuthRouter,
  auth: "none",
};
