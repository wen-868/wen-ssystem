import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as appVersionController from "../controllers/platform/app-version.controller";
import { requirePlatformPermission } from "../middleware/platform-rbac";

/** 公开：客户端版本检查 */
export const appVersionPublicRouter = Router();
appVersionPublicRouter.get("/version/:platform", appVersionController.checkAppVersion);

/** 总台：版本管理 */
export const appVersionAdminRouter = Router();
appVersionAdminRouter.get("/app-versions", requirePlatformPermission("sysconfig:view"), appVersionController.listAppVersions);
// C6-1A（#34）：草稿保存 —— 具体路径必须排在 /app-versions/:id/... 之前
appVersionAdminRouter.post("/app-versions/draft", requirePlatformPermission("sysconfig:manage"), appVersionController.saveAppVersionDraft);
appVersionAdminRouter.post("/app-versions", requirePlatformPermission("sysconfig:manage"), appVersionController.createAppVersion);
// C6-1A（#36）：放量控制与归档（t_app_version.status / gray_ratio / archived_at，178 迁移加列）
appVersionAdminRouter.post("/app-versions/:id/pause", requirePlatformPermission("sysconfig:manage"), appVersionController.pauseAppVersion);
appVersionAdminRouter.post("/app-versions/:id/resume", requirePlatformPermission("sysconfig:manage"), appVersionController.resumeAppVersion);
appVersionAdminRouter.post("/app-versions/:id/archive", requirePlatformPermission("sysconfig:manage"), appVersionController.archiveAppVersion);
// C6-1A（#39）：回滚到指定已发布版本（零 DDL，口径见凌舟裁定 R5②）
appVersionAdminRouter.post("/app-versions/:id/rollback", requirePlatformPermission("sysconfig:manage"), appVersionController.rollbackAppVersion);
appVersionAdminRouter.delete("/app-versions/:id", requirePlatformPermission("sysconfig:manage"), appVersionController.removeAppVersion);

export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/app", router: appVersionPublicRouter, auth: "none" },
  // 注意：管理端不用 /api/platform 前缀——Express app.use(prefix, middleware, router)
  // 会让 requirePlatformAuth 拦截同前缀下的全部请求（含 /api/platform/auth/login），
  // 导致总台登录被 401。使用独立前缀 /api/padmin 隔离。
  { prefix: "/api/padmin", router: appVersionAdminRouter, auth: "requirePlatformAuth" },
];
