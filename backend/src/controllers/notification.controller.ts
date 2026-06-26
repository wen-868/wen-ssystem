import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import * as service from "../services/admin/notification.service.js";

// ==================== 管理后台通知 ====================

export const listNotifications = asyncHandler(async (req, res) => {
  const result = await service.listNotifications({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!,
    type: req.query.type as string | undefined,
    isRead: req.query.isRead !== undefined && req.query.isRead !== "" ? Number(req.query.isRead) : undefined,
  });
  res.json(ok(result));
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const result = await service.getUnreadCount(req.user!.id, "ADMIN", req.tenantId!);
  res.json(ok(result));
});

export const markAsRead = asyncHandler(async (req, res) => {
  const result = await service.markAsRead(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await service.markAllAsRead(req.user!.id, "ADMIN", req.tenantId!);
  res.json(ok(result));
});

export const send = asyncHandler(async (req, res) => {
  const result = await service.sendNotification({
    recipientId: req.body.recipientId,
    recipientType: req.body.recipientType ?? "ADMIN",
    title: req.body.title,
    content: req.body.content,
    type: req.body.type ?? "SYSTEM",
    relatedId: req.body.relatedId ?? null,
    relatedType: req.body.relatedType ?? null,
    tenantId: req.tenantId!,
  });
  res.json(ok(result));
});

// ==================== 小程序通知 ====================

export const listMiniappNotifications = asyncHandler(async (req, res) => {
  const recipientId = req.user!.id;
  if (!recipientId) {
    res.status(401).json({ code: "401", message: "未登录" });
    return;
  }
  const result = await service.listMiniappNotifications({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    recipientId,
    tenantId: req.tenantId!,
  });
  res.json(ok(result));
});

export const getMiniappUnreadCount = asyncHandler(async (req, res) => {
  const recipientId = req.user!.id;
  if (!recipientId) {
    res.status(401).json({ code: "401", message: "未登录" });
    return;
  }
  const result = await service.getMiniappUnreadCount(recipientId, req.tenantId!);
  res.json(ok(result));
});

export const markMiniappAsRead = asyncHandler(async (req, res) => {
  const result = await service.markAsRead(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const markMiniappAllAsRead = asyncHandler(async (req, res) => {
  const recipientId = req.user!.id;
  if (!recipientId) {
    res.status(401).json({ code: "401", message: "未登录" });
    return;
  }
  const result = await service.markAllAsRead(recipientId, "CONSUMER", req.tenantId!);
  res.json(ok(result));
});