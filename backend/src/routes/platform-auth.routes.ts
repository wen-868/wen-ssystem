import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePlatformAuth } from "../middleware/auth";
import { csrfMiddleware } from "../middleware/csrf";
import { platformLogin, getPlatformMe, createPlatformAdmin } from "../controllers/platform/platform-auth.controller";

export const platformAuthRouter = Router();

platformAuthRouter.post("/login", asyncHandler(platformLogin));
platformAuthRouter.get("/me", requirePlatformAuth, asyncHandler(getPlatformMe));
// 写操作接口需挂载 csrfMiddleware（routeConfig.auth="none"，auto-routes 不会附加）
platformAuthRouter.post("/admin/create", requirePlatformAuth, csrfMiddleware, asyncHandler(createPlatformAdmin));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/auth",
  router: platformAuthRouter,
  auth: "none",
};
