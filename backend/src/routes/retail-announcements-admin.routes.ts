import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as retailAnnouncementsAdminController from "../controllers/admin/retail-announcements-admin.controller";

export const retailAnnouncementsAdminRouter = Router();

// 公告管理（admin-web 前端契约：/api/admin/retail-announcements）
retailAnnouncementsAdminRouter.get("/", retailAnnouncementsAdminController.listAnnouncements);
retailAnnouncementsAdminRouter.post("/", retailAnnouncementsAdminController.createAnnouncement);
retailAnnouncementsAdminRouter.put("/:id", retailAnnouncementsAdminController.updateAnnouncement);
retailAnnouncementsAdminRouter.delete("/:id", retailAnnouncementsAdminController.deleteAnnouncement);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/retail-announcements",
  router: retailAnnouncementsAdminRouter,
  auth: "requireAuthWithTenant",
};
