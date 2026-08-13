import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as appVersionController from "../controllers/platform/app-version.controller";

/** 公开：客户端版本检查 */
export const appVersionPublicRouter = Router();
appVersionPublicRouter.get("/version/:platform", appVersionController.checkAppVersion);

/** 总台：版本管理 */
export const appVersionAdminRouter = Router();
appVersionAdminRouter.get("/app-versions", appVersionController.listAppVersions);
appVersionAdminRouter.post("/app-versions", appVersionController.createAppVersion);
appVersionAdminRouter.delete("/app-versions/:id", appVersionController.removeAppVersion);

export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/app", router: appVersionPublicRouter, auth: "none" },
  // 注意：管理端不用 /api/platform 前缀——Express app.use(prefix, middleware, router)
  // 会让 requirePlatformAuth 拦截同前缀下的全部请求（含 /api/platform/auth/login），
  // 导致总台登录被 401。使用独立前缀 /api/padmin 隔离。
  { prefix: "/api/padmin", router: appVersionAdminRouter, auth: "requirePlatformAuth" },
];
