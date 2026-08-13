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
  { prefix: "/api/platform", router: appVersionAdminRouter, auth: "requirePlatformAuth" },
];
