import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as todoCtrl from "../controllers/admin/todo.controller";
import * as quickEntryCtrl from "../controllers/admin/quick-entry.controller";
import * as notificationCtrl from "../controllers/admin/notification-center.controller";

export const workbenchRouter = Router();

// ========== 待办提醒 ==========
workbenchRouter.get("/todos", todoCtrl.listTodos);
workbenchRouter.get("/todos/stats", todoCtrl.getTodoStats);
workbenchRouter.post("/todos", todoCtrl.createTodo);
workbenchRouter.put("/todos/:id/complete", todoCtrl.completeTodo);
workbenchRouter.put("/todos/:id/dismiss", todoCtrl.dismissTodo);
workbenchRouter.delete("/todos/:id", todoCtrl.deleteTodo);

// ========== 快捷入口 ==========
workbenchRouter.get("/quick-entries", quickEntryCtrl.listQuickEntries);
workbenchRouter.post("/quick-entries", quickEntryCtrl.createQuickEntry);
workbenchRouter.put("/quick-entries/sort", quickEntryCtrl.sortQuickEntries);
workbenchRouter.put("/quick-entries/:id", quickEntryCtrl.updateQuickEntry);
workbenchRouter.delete("/quick-entries/:id", quickEntryCtrl.deleteQuickEntry);

// ========== 消息中心 ==========
workbenchRouter.get("/wb-notifications", notificationCtrl.listNotifications);
workbenchRouter.get("/wb-notifications/unread-count", notificationCtrl.getUnreadCount);
workbenchRouter.get("/wb-notifications/type-stats", notificationCtrl.getTypeStats);
workbenchRouter.put("/wb-notifications/:id/read", notificationCtrl.markAsRead);
workbenchRouter.post("/wb-notifications/read-all", notificationCtrl.markAllRead);
workbenchRouter.delete("/wb-notifications/:id", notificationCtrl.deleteNotification);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: workbenchRouter,
  auth: "requireAuthWithTenant",
};
