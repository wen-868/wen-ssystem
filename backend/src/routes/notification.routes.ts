import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import * as ctrl from "../controllers/notification.controller";
import type { RouteConfig } from "../shared/auto-routes";

export { sendNotification, type SendNotificationParams } from "../shared/notification-sender";

export const adminNotificationRouter = Router();

adminNotificationRouter.get("/", requireAuthWithTenant, ctrl.listNotifications);
adminNotificationRouter.get("/unread-count", requireAuthWithTenant, ctrl.getUnreadCount);
adminNotificationRouter.put("/:id/read", requireAuthWithTenant, ctrl.markAsRead);
adminNotificationRouter.post("/read-all", requireAuthWithTenant, ctrl.markAllAsRead);
adminNotificationRouter.post("/send", requireAuthWithTenant, ctrl.send);

export const miniappNotificationRouter = Router();

miniappNotificationRouter.get("/", requireAuthWithTenant, ctrl.listMiniappNotifications);
miniappNotificationRouter.get("/unread-count", requireAuthWithTenant, ctrl.getMiniappUnreadCount);
miniappNotificationRouter.put("/:id/read", requireAuthWithTenant, ctrl.markMiniappAsRead);
miniappNotificationRouter.post("/read-all", requireAuthWithTenant, ctrl.markMiniappAllAsRead);

export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/admin/notifications", router: adminNotificationRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/miniapp/notifications", router: miniappNotificationRouter, auth: "none" },
];
