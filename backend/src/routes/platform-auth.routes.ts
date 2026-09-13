import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePlatformAuth } from "../middleware/auth";
import { csrfMiddleware } from "../middleware/csrf";
import { requireCaptcha } from "../middleware/captcha-guard";
import { platformLogin, getPlatformMe, createPlatformAdmin, getCaptcha } from "../controllers/platform/platform-auth.controller";

export const platformAuthRouter = Router();

// 图形验证码下发（R101-S2-01 裁定 4.1）：公开接口，仅允许 GET（csrfMiddleware 对安全方法放行）
platformAuthRouter.get("/captcha", asyncHandler(getCaptcha));
// 登录前先校验图形验证码（中间件承担，controller 与 service 签名不变）
platformAuthRouter.post("/login", requireCaptcha, asyncHandler(platformLogin));
platformAuthRouter.get("/me", requirePlatformAuth, asyncHandler(getPlatformMe));
// 写操作接口需挂载 csrfMiddleware（routeConfig.auth="none"，auto-routes 不会附加）
platformAuthRouter.post("/admin/create", requirePlatformAuth, csrfMiddleware, asyncHandler(createPlatformAdmin));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/auth",
  router: platformAuthRouter,
  auth: "none",
};
