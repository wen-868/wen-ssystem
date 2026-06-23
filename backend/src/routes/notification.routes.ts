import { Router } from "express";
import { z } from "zod";
import { requireAuthWithTenant } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne } from "../shared/db.js";
import { pool } from "../shared/db.js";
import { ok } from "../shared/response.js";
import type { Pool } from "mysql2/promise";

// ========== 通知发送工具函数 ==========

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
  return (result as any).insertId;
}

// ========== 管理后台通知路由 ==========

export const adminNotificationRouter = Router();

// 通知列表
adminNotificationRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["n.tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (req.query.type) {
    conditions.push("n.type = ?");
    params.push(req.query.type);
  }
  if (req.query.isRead !== undefined && req.query.isRead !== "") {
    conditions.push("n.is_read = ?");
    params.push(Number(req.query.isRead));
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const records = await query<any>(
    `SELECT n.id, n.recipient_id AS recipientId, n.recipient_type AS recipientType,
            n.title, n.content, n.type,
            n.related_id AS relatedId, n.related_type AS relatedType,
            n.is_read AS isRead, n.sent_at AS sentAt, n.read_at AS readAt,
            n.created_at AS createdAt
     FROM notification n
     ${where}
     ORDER BY n.sent_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM notification n ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  }));
}));

// 未读数量
adminNotificationRouter.get("/unread-count", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const count = await queryOne<any>(
    `SELECT COUNT(*) AS count FROM notification WHERE recipient_id = ? AND recipient_type = 'ADMIN' AND is_read = 0 AND tenant_id = ?`,
    [req.user!.id, tenantId]
  );

  res.json(ok({ count: Number(count?.count ?? 0) }));
}));

// 标记已读
adminNotificationRouter.put("/:id/read", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  await query(
    `UPDATE notification SET is_read = 1, read_at = NOW() WHERE id = ? AND tenant_id = ? AND is_read = 0`,
    [id, tenantId]
  );

  res.json(ok({ marked: true }));
}));

// 全部标记已读
adminNotificationRouter.post("/read-all", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  await query(
    `UPDATE notification SET is_read = 1, read_at = NOW()
     WHERE recipient_id = ? AND recipient_type = 'ADMIN' AND is_read = 0 AND tenant_id = ?`,
    [req.user!.id, tenantId]
  );

  res.json(ok({ marked: true }));
}));

// 手动发送通知
adminNotificationRouter.post("/send", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    recipientId: z.number().int().positive(),
    recipientType: z.enum(["ADMIN", "MERCHANT", "CONSUMER"]).default("ADMIN"),
    title: z.string().min(1).max(200),
    content: z.string().max(2000),
    type: z.enum(["SYSTEM", "ORDER", "PAYMENT", "ALERT", "CREDIT", "RECALL"]).default("SYSTEM"),
    relatedId: z.number().int().positive().optional(),
    relatedType: z.string().max(50).optional()
  }).parse(req.body);

  const id = await sendNotification(pool, {
    recipientId: body.recipientId,
    recipientType: body.recipientType,
    title: body.title,
    content: body.content,
    type: body.type,
    relatedId: body.relatedId ?? null,
    relatedType: body.relatedType ?? null,
    tenantId
  });

  res.json(ok({ id, sent: true }));
}));

// ========== 小程序通知路由 ==========

export const miniappNotificationRouter = Router();

// 我的通知列表
miniappNotificationRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;

  // 从token中获取用户ID
  const recipientId = req.user!.id;
  if (!recipientId) {
    res.status(401).json({ code: "401", message: "未登录" });
    return;
  }

  const records = await query<any>(
    `SELECT id, title, content, type,
            related_id AS relatedId, related_type AS relatedType,
            is_read AS isRead, sent_at AS sentAt, read_at AS readAt
     FROM notification
     WHERE recipient_id = ? AND recipient_type = 'CONSUMER' AND tenant_id = ?
     ORDER BY sent_at DESC
     LIMIT ? OFFSET ?`,
    [recipientId, tenantId, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM notification WHERE recipient_id = ? AND recipient_type = 'CONSUMER' AND tenant_id = ?`,
    [recipientId, tenantId]
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  }));
}));

// 未读数量
miniappNotificationRouter.get("/unread-count", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const recipientId = req.user!.id;
  if (!recipientId) {
    res.status(401).json({ code: "401", message: "未登录" });
    return;
  }

  const count = await queryOne<any>(
    `SELECT COUNT(*) AS count FROM notification WHERE recipient_id = ? AND recipient_type = 'CONSUMER' AND is_read = 0 AND tenant_id = ?`,
    [recipientId, tenantId]
  );

  res.json(ok({ count: Number(count?.count ?? 0) }));
}));

// 标记已读
miniappNotificationRouter.put("/:id/read", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  await query(
    `UPDATE notification SET is_read = 1, read_at = NOW() WHERE id = ? AND tenant_id = ? AND is_read = 0`,
    [id, tenantId]
  );

  res.json(ok({ marked: true }));
}));

// 全部已读
miniappNotificationRouter.post("/read-all", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const recipientId = req.user!.id;
  if (!recipientId) {
    res.status(401).json({ code: "401", message: "未登录" });
    return;
  }

  await query(
    `UPDATE notification SET is_read = 1, read_at = NOW()
     WHERE recipient_id = ? AND recipient_type = 'CONSUMER' AND is_read = 0 AND tenant_id = ?`,
    [recipientId, tenantId]
  );

  res.json(ok({ marked: true }));
}));
