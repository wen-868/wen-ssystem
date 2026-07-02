import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/notification.controller.js";

// ========== 管理后台通知路由 ==========

export const adminNotificationRouter = Router();

adminNotificationRouter.get("/", requireAuthWithTenant, ctrl.listNotifications);
adminNotificationRouter.get("/unread-count", requireAuthWithTenant, ctrl.getUnreadCount);
adminNotificationRouter.put("/:id/read", requireAuthWithTenant, ctrl.markAsRead);
adminNotificationRouter.post("/read-all", requireAuthWithTenant, ctrl.markAllAsRead);
adminNotificationRouter.post("/send", requireAuthWithTenant, ctrl.send);

// ========== 小程序通知路由 ==========

export const miniappNotificationRouter = Router();

miniappNotificationRouter.get("/", requireAuthWithTenant, ctrl.listMiniappNotifications);
miniappNotificationRouter.get("/unread-count", requireAuthWithTenant, ctrl.getMiniappUnreadCount);
miniappNotificationRouter.put("/:id/read", requireAuthWithTenant, ctrl.markMiniappAsRead);
miniappNotificationRouter.post("/read-all", requireAuthWithTenant, ctrl.markMiniappAllAsRead);