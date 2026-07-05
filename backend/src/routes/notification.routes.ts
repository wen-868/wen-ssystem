import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import { pool } from "../shared/db.js";
import type { Pool } from "mysql2/promise";
import * as ctrl from "../controllers/notification.controller.js";
import type { RouteConfig } from "../shared/auto-routes.js";

// ========== 通知发送工具函数（被其他模块引用） ==========

export interface SendNotificationParams {
  recipientId: number;
  recipientType: "ADMIN" | "MERCHANT" | "CONSUMER";
  title: string;
  content: string;
  type: "SYSTEM" | "ORDER" | "PAYMENT" | "ALERT" | "CREDIT" | "RECALL";
  relatedId?: number | null;
  relatedType?: string | null;
  tenantId: string;
}

export async function sendNotification(
  dbPool: Pool,
  params: SendNotificationParams
): Promise<number> {
  const [result] = await dbPool.query(
    `INSERT INTO notification (recipient_id, recipient_type, title, content, type, related_id, related_type, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.recipientId,
      params.recipientType,
      params.title,
      params.content,
      params.type,
      params.relatedId ?? null,
      params.relatedType ?? null,
      params.tenantId
    ]
  );
  return (result as { insertId: number }).insertId;
}

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

// ========== 路由自动发现配置 ==========
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/admin/notifications", router: adminNotificationRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/miniapp/notifications", router: miniappNotificationRouter, auth: "none" },
];