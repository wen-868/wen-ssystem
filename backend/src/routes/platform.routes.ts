import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { getPlatformOverview, listPlatformTenants } from "../controllers/admin/platform.controller";

// R48-05: 平台总览路由，保持 prefix /api/platform
export const platformRouter = Router();

// ========== 平台总览 ==========
platformRouter.get("/overview", asyncHandler(getPlatformOverview));
platformRouter.get("/tenants", asyncHandler(listPlatformTenants));

// ========== 平台公告 ==========
// R101-S2-R1（P1-3）：原此处注册了 GET/POST /api/platform/announcements 两个 handler，二者为死代码。
// 原因：公告由 admin-platform-announcement.routes.ts（prefix "/api/platform/announcements"）唯一提供；
// auto-routes 按文件名排序注册（"admin-platform-announcement..." < "platform-..."），该文件先注册，
// Express 对同一"方法+完整路径"只命中先注册者，故本文件这两个 handler 永远不会被调用。
// 公告的列表/详情/新建/更新/删除/发布六项能力已由上述文件全覆盖，删除不丢功能。

export const routeConfig: RouteConfig = {
  prefix: "/api/platform",
  router: platformRouter,
  auth: "requirePlatformAuth",
};
