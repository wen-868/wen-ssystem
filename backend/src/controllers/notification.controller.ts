import { z } from "zod";
import { asyncHandler } from "../middleware/async-handler.js";
import { ok, fail } from "../shared/response.js";
import * as service from "../services/admin/notification.service.js";

// ========== 管理后台通知 Controller ==========

export const list = asyncHandler(async (req, res) => {
  const result = await service.listNotifications(
    req.tenantId!,
    {
      type: req.query.type as string | undefined,
      isRead: req.query.isRead !== undefined && req.query.isRead !== "" ? Number(req.query.isRead) : undefined,
    },
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
  res.json(ok(result));
});

export const unreadCount = asyncHandler(async (req, res) => {
  const result = await service.getUnreadCount(req.tenantId!, req.user!.id);
  res.json(ok(result));
});

export const markRead = asyncHandler(async (req, res) => {
  const result = await service.markAsRead(req.tenantId!, Number(req.params.id));
  res.json(ok(result));
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await service.markAllRead(req.tenantId!, req.user!.id);
  res.json(ok(result));
});

export const send = asyncHandler(async (req, res) => {
  const body = z.object({
    recipientId: z.number().int().positive(),
    recipientType: z.enum(["ADMIN", "MERCHANT", "CONSUMER"]).default("ADMIN"),
    title: z.string().min(1).max(200),
    content: z.string().max(2000),
    type: z.enum(["SYSTEM", "ORDER", "PAYMENT", "ALERT", "CREDIT", "RECALL"]).default("SYSTEM"),
    relatedId: z.number().int().positive().optional(),
    relatedType: z.string().max(50).optional()
  }).parse(req.body);

  const id = await service.sendNotification({
    recipientId: body.recipientId,
    recipientType: body.recipientType,
    title: body.title,
    content: body.content,
    type: body.type,
    relatedId: body.relatedId ?? null,
    relatedType: body.relatedType ?? null,
    tenantId: req.tenantId!
  });

  res.json(ok({ id, sent: true }));
});

// ========== 小程序通知 Controller ==========

export const myList = asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  if (!userId) {
    res.status(401).json(fail("未登录", "401"));
    return;
  }

  const result = await service.listMyNotifications(
    req.tenantId!,
    userId,
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
  res.json(ok(result));
});

export const myUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  if (!userId) {
    res.status(401).json(fail("未登录", "401"));
    return;
  }

  const result = await service.getMyUnreadCount(req.tenantId!, userId);
  res.json(ok(result));
});

export const myMarkRead = asyncHandler(async (req, res) => {
  const result = await service.markMyRead(req.tenantId!, Number(req.params.id));
  res.json(ok(result));
});

export const myMarkAllRead = asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  if (!userId) {
    res.status(401).json(fail("未登录", "401"));
    return;
  }

  const result = await service.markMyAllRead(req.tenantId!, userId);
  res.json(ok(result));
});

// 别名：routes 层引用的名称
export const listNotifications = list;
export const getUnreadCount = unreadCount;
export const markAsRead = markRead;
export const markAllAsRead = markAllRead;
export const listMiniappNotifications = myList;
export const getMiniappUnreadCount = myUnreadCount;
export const markMiniappAsRead = myMarkRead;
export const markMiniappAllAsRead = myMarkAllRead;