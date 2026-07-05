import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as retailAnnouncementController from "../controllers/admin/retail-announcement.controller.js";

export const retailAnnouncementRouter = Router();

// Admin routes (require auth)
retailAnnouncementRouter.get("/admin/retail-announcements", requireAuth, retailAnnouncementController.listAnnouncements);
retailAnnouncementRouter.post("/admin/retail-announcements", requireAuth, retailAnnouncementController.createAnnouncement);
retailAnnouncementRouter.put("/admin/retail-announcements/:id", requireAuth, retailAnnouncementController.updateAnnouncement);
retailAnnouncementRouter.delete("/admin/retail-announcements/:id", requireAuth, retailAnnouncementController.deleteAnnouncement);

// Public miniapp route (no auth required)
retailAnnouncementRouter.get("/miniapp/retail-announcements", retailAnnouncementController.getActiveAnnouncements);