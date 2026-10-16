import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import { requireConsumerAuthWithTenant } from "../middleware/consumer-auth";
import { csrfMiddleware } from "../middleware/csrf";
import { requirePermission } from "../middleware/rbac-auth";
import { PERM_SYSTEM_NOTIFICATION_SEND } from "../shared/system-permission-codes";
import * as ctrl from "../controllers/admin/notification.controller";
import type { RouteConfig } from "../shared/auto-routes";

export { sendNotification, type SendNotificationParams } from "../shared/notification-sender";

export const adminNotificationRouter = Router();

adminNotificationRouter.get("/", ctrl.listNotifications);
adminNotificationRouter.get("/unread-count", ctrl.getUnreadCount);
adminNotificationRouter.put("/:id/read", ctrl.markAsRead);
adminNotificationRouter.post("/read-all", ctrl.markAllAsRead);
// S3-237（接线批 10 · 组 1「系统设置/基础域」）：`POST /send` 挂 S3-232 已立的新码 `system:notification:send`。
// 唯一前端调用点 = `admin-web/src/views/inventory/InventoryPriceQuote.vue:256`，该页
// `admin-web/src/router/index.ts:144` 的 `meta.roles` = **["SUPER_ADMIN"]** 单角色
// ⇒ 使用者 ⊆ 码持有者（超管持 `*`），无 403 回归。
adminNotificationRouter.post("/send", requirePermission(PERM_SYSTEM_NOTIFICATION_SEND), ctrl.send);
// ⚠️ S3-237 本批**不接**同文件另外 4 条写端点（`PUT /:id/read`、`POST /read-all`、`DELETE /:id`、
//   `POST /batch-delete`，即 204 已立的 `system:notification:read|read-all|delete|batch-delete`）：
//   它们的唯一调用点是**手机端消息页**（`app-mobile/src/pages/notifications/notifications.vue:332/384/413/438/467`、
//   `notification-detail.vue:120/139/156` → `api/modules/notifications.ts:139/166/161/169`），而该页
//   ① 入口无任何权限门（`pages/home/home.vue:16` 的消息图标无条件渲染；`app-mobile/src/config/permission-gates.ts`
//      全表 0 处引用 `/api/admin/notifications/*`）⇒ 在用角色（店长 1 账号 / 操作员 1 账号）能打开并调用；
//   ② 这两个在用角色**不持** `system:notification:*` 任何一条（`store:*`/`sale:*` 等域通配都不跨 `system` 域）；
//   ⇒ 按授权模型不变量 **I1'**（①持码 ②前端按码只读 ③页面不开放；三条都不成立 ⇒ 不接并登记），
//      本批**不接**、只登记，待前端补门后收编（详见 `docs/tasks/R101-RBAC接线缺口清单.md` §二十 与回传卡 §五）。
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
