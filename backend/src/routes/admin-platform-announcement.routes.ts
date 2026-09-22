import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/platform-announcement.controller";
import * as templateController from "../controllers/platform/announcement-template.controller";

export const adminPlatformAnnouncementRouter = Router();

adminPlatformAnnouncementRouter.get("/", asyncHandler(controller.listAnnouncements));
// C2-0 实现段新增：公告模板清单（0 DDL，走 t_platform_config）
// 必须排在 GET /:id 之前，否则 /templates 会被通配 /:id 吃掉（既有 6 端点一行未改）
adminPlatformAnnouncementRouter.get("/templates", asyncHandler(templateController.listAnnouncementTemplates));
adminPlatformAnnouncementRouter.put("/templates", asyncHandler(templateController.saveAnnouncementTemplates));
adminPlatformAnnouncementRouter.get("/:id", asyncHandler(controller.getAnnouncementById));
adminPlatformAnnouncementRouter.post("/", asyncHandler(controller.createAnnouncement));
adminPlatformAnnouncementRouter.put("/:id", asyncHandler(controller.updateAnnouncement));
adminPlatformAnnouncementRouter.delete("/:id", asyncHandler(controller.deleteAnnouncement));
adminPlatformAnnouncementRouter.post("/:id/publish", asyncHandler(controller.togglePublish));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/announcements",
  router: adminPlatformAnnouncementRouter,
  auth: "requirePlatformAuth",
};
