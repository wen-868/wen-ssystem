import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as notificationCenterService from "../../services/admin/notification-center.service";

export const listNotifications = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const type = req.query.type as string | undefined;
  const isRead = req.query.isRead !== undefined && req.query.isRead !== "" 
    ? Number(req.query.isRead) 
    : undefined;
  const result = await notificationCenterService.listNotifications(tenantId, page, pageSize, type, isRead);
  res.json(ok(result));
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await notificationCenterService.getUnreadCount(tenantId);
  res.json(ok(result));
});

export const getTypeStats = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await notificationCenterService.getTypeStats(tenantId);
  res.json(ok(result));
});

export const markAsRead = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const result = await notificationCenterService.markAsRead(tenantId, id);
  res.json(ok(result));
});

export const markAllRead = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await notificationCenterService.markAllRead(tenantId);
  res.json(ok(result));
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const result = await notificationCenterService.deleteNotification(tenantId, id);
  res.json(ok(result));
});