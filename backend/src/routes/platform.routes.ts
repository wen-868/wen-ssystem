import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { getPlatformOverview, listPlatformTenants } from "../controllers/admin/platform.controller";
import {
  listAdmins,
  createAdmin,
  inviteAdmin,
  resetAdminPassword,
  updateAdminStatus,
} from "../controllers/platform/platform.controller";

// R48-05: 平台总览路由，保持 prefix /api/platform
export const platformRouter = Router();

// ========== 平台总览 ==========
platformRouter.get("/overview", asyncHandler(getPlatformOverview));
platformRouter.get("/tenants", asyncHandler(listPlatformTenants));

// ========== 平台管理员（C6-1A 挂载，R101-C6-0 §三.1 #41/#45/#51/#53/#64） ==========
// 说明：controller/services/platform/admin-account.service.ts 的实现早已存在，
// 此前**只有单测引用、无任何路由文件注册**（C6-0 §二.4：backend/src 检索 "platform/admins" 0 命中），
// 故 C6-1A 只做「挂载」这一处接线，不重写既有服务与控制器实现。
// 路由顺序：/admins/invite 为具体路径，必须排在 /admins/:id/... 之前（避免被当成 id）。
platformRouter.get("/admins", asyncHandler(listAdmins));
platformRouter.post("/admins/invite", asyncHandler(inviteAdmin));
platformRouter.post("/admins/:id/reset-password", asyncHandler(resetAdminPassword));
platformRouter.put("/admins/:id/status", asyncHandler(updateAdminStatus));
// 保留既有 POST /admins 建号能力（password 由调用方给定的场景）；「邀请」走 /admins/invite
platformRouter.post("/admins", asyncHandler(createAdmin));

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
