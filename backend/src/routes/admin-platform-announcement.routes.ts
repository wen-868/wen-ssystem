import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/platform-announcement.controller";

export const adminPlatformAnnouncementRouter = Router();

adminPlatformAnnouncementRouter.get("/", asyncHandler(controller.listAnnouncements));
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
