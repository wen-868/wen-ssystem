import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePlatformAuth } from "../middleware/auth";
import { csrfMiddleware } from "../middleware/csrf";
import { requireCaptcha } from "../middleware/captcha-guard";
import { loginFailLimiters } from "../middleware/login-fail-limiter";
import { platformLogin, getPlatformMe, createPlatformAdmin, getCaptcha } from "../controllers/platform/platform-auth.controller";

export const platformAuthRouter = Router();

// 图形验证码下发（R101-S2-01 裁定 4.1）：公开接口，仅允许 GET（csrfMiddleware 对安全方法放行）
platformAuthRouter.get("/captcha", asyncHandler(getCaptcha));
// 登录：先过失败限流（IP + 账号双维度，批 2.1），再校验图形验证码（裁定 4.1）。
// 限流放在验证码之前，使「验证码校验失败」这类 400 也计入尝试次数——同属登录尝试。
// 校验逻辑全部由中间件承担，controller 与 service 签名不变。
platformAuthRouter.post(
  "/login",
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
