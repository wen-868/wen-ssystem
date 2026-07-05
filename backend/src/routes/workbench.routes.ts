import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as todoCtrl from "../controllers/admin/todo.controller.js";
import * as quickEntryCtrl from "../controllers/admin/quick-entry.controller.js";
import * as notificationCtrl from "../controllers/admin/notification-center.controller.js";

export const workbenchRouter = Router();

// ========== 待办提醒 ==========
workbenchRouter.get("/todos", requireAuthWithTenant, todoCtrl.listTodos);
workbenchRouter.get("/todos/stats", requireAuthWithTenant, todoCtrl.getTodoStats);
workbenchRouter.post("/todos", requireAuthWithTenant, todoCtrl.createTodo);
workbenchRouter.put("/todos/:id/complete", requireAuthWithTenant, todoCtrl.completeTodo);
workbenchRouter.put("/todos/:id/dismiss", requireAuthWithTenant, todoCtrl.dismissTodo);
workbenchRouter.delete("/todos/:id", requireAuthWithTenant, todoCtrl.deleteTodo);

// ========== 快捷入口 ==========
workbenchRouter.get("/quick-entries", requireAuthWithTenant, quickEntryCtrl.listQuickEntries);
workbenchRouter.post("/quick-entries", requireAuthWithTenant, quickEntryCtrl.createQuickEntry);
workbenchRouter.put("/quick-entries/sort", requireAuthWithTenant, quickEntryCtrl.sortQuickEntries);
workbenchRouter.put("/quick-entries/:id", requireAuthWithTenant, quickEntryCtrl.updateQuickEntry);
workbenchRouter.delete("/quick-entries/:id", requireAuthWithTenant, quickEntryCtrl.deleteQuickEntry);

// ========== 消息中心 ==========
workbenchRouter.get("/wb-notifications", requireAuthWithTenant, notificationCtrl.listNotifications);
workbenchRouter.get("/wb-notifications/unread-count", requireAuthWithTenant, notificationCtrl.getUnreadCount);
workbenchRouter.get("/wb-notifications/type-stats", requireAuthWithTenant, notificationCtrl.getTypeStats);
workbenchRouter.put("/wb-notifications/:id/read", requireAuthWithTenant, notificationCtrl.markAsRead);
workbenchRouter.post("/wb-notifications/read-all", requireAuthWithTenant, notificationCtrl.markAllRead);
workbenchRouter.delete("/wb-notifications/:id", requireAuthWithTenant, notificationCtrl.deleteNotification);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: workbenchRouter,
  auth: "requireAuthWithTenant",
};
