import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import { requireConsumerAuthWithTenant } from "../middleware/consumer-auth";
import { csrfMiddleware } from "../middleware/csrf";
import * as ctrl from "../controllers/admin/notification.controller";
import type { RouteConfig } from "../shared/auto-routes";

export { sendNotification, type SendNotificationParams } from "../shared/notification-sender";

export const adminNotificationRouter = Router();

adminNotificationRouter.get("/", ctrl.listNotifications);
adminNotificationRouter.get("/unread-count", ctrl.getUnreadCount);
adminNotificationRouter.put("/:id/read", ctrl.markAsRead);
adminNotificationRouter.post("/read-all", ctrl.markAllAsRead);
adminNotificationRouter.post("/send", ctrl.send);
adminNotificationRouter.get("/:id", ctrl.getNotificationDetail);
adminNotificationRouter.delete("/:id", ctrl.deleteNotification);
adminNotificationRouter.post("/batch-delete", ctrl.batchDeleteNotifications);

export const miniappNotificationRouter = Router();

// S3-196（总清单第 58 项）：消费者端身份改用 requireConsumerAuthWithTenant（接受微信令牌），
// 并给 2 个写端点补 csrfMiddleware（**认证在前**，csrfMiddleware 依赖 req.user）——
// 这两条此前是 `R2_EXEMPT` 登记的唯一理由（"客户端拿不到 CSRF 令牌"）；客户端已统一走
// app.request 携带 x-csrf-token，故豁免同时删除，改由真覆盖守住（guard-route-auth 仍 EXIT=0）。
miniappNotificationRouter.get("/", requireConsumerAuthWithTenant, ctrl.listMiniappNotifications);
miniappNotificationRouter.get("/unread-count", requireConsumerAuthWithTenant, ctrl.getMiniappUnreadCount);
miniappNotificationRouter.put("/:id/read", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.markMiniappAsRead);
miniappNotificationRouter.post("/read-all", requireConsumerAuthWithTenant, csrfMiddleware, ctrl.markMiniappAllAsRead);

export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/admin/notifications", router: adminNotificationRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/miniapp/notifications", router: miniappNotificationRouter, auth: "none" },
];
