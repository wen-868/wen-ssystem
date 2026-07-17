import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { getPlatformOverview, listPlatformTenants } from "../controllers/admin/platform.controller";
import {
  listAnnouncements,
  createAnnouncement,
} from "../controllers/platform/platform-manage.controller";

// R48-05: 平台总览路由，保持 prefix /api/platform
// 整合原 platform-config.routes.ts 中的公告路由，使路径与功能归属一致
export const platformRouter = Router();

// ========== 平台总览 ==========
platformRouter.get("/overview", asyncHandler(getPlatformOverview));
platformRouter.get("/tenants", asyncHandler(listPlatformTenants));

// ========== 平台公告 ==========
// GET /api/platform/announcements - 公告列表
platformRouter.get("/announcements", asyncHandler(listAnnouncements));

// POST /api/platform/announcements - 发布公告
platformRouter.post("/announcements", asyncHandler(createAnnouncement));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform",
  router: platformRouter,
  auth: "requirePlatformAuth",
};
