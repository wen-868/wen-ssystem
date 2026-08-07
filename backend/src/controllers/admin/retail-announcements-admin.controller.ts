/**
 * 即时零售公告管理 Controller（别名路由 /api/admin/retail-announcements）
 *
 * 背景（ajian_retail_fix_01）：后端原有实现挂载在 /api/retail-announcement/admin/retail-announcements，
 * 而 admin-web 前端调用 /api/admin/retail-announcements，且期望分页 + camelCase + storeId 入参。
 * 本控制器按前端契约实现，复用 retail-announcement.service 的数据逻辑。
 *
 * 安全要点（沿用 R55-01）：
 *   - storeId 优先取请求体 body.storeId（前端表单必填），其次 req.user.storeId（JWT），
 *     超级管理员允许从 query 显式指定。
 *   - update/delete 由 service 层 store_id + tenant_id 双重校验。
 */

import { z } from "zod";
import type { Request } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import { hasAnyRole } from "../../middleware/auth";
import * as retailAnnouncementService from "../../services/instant-retail/retail-announcement.service";

const createAnnouncementSchema = z.object({
  storeId: z.number().int().positive(),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  isTop: z.boolean().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

const updateAnnouncementSchema = z.object({
  storeId: z.number().int().positive().optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
  isTop: z.boolean().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z.enum(["ENABLED", "DISABLED"]).optional(),
});

const listQuerySchema = z.object({
  storeId: z.coerce.number().int().positive().optional(),
  keyword: z.string().optional(),
});

const SUPER_ROLES = ["SUPER_ADMIN", "OPERATION_ADMIN"];

/** 解析门店ID：body.storeId → req.user.storeId → query.storeId（超级管理员） */
function resolveStoreId(req: Request): number | null {
  const bodyStoreId = (req.body as { storeId?: unknown })?.storeId;
  const bodyNum = typeof bodyStoreId === "number" ? bodyStoreId : NaN;
  if (!Number.isNaN(bodyNum) && bodyNum > 0) {
    return bodyNum;
  }
  const userStoreId = req.user?.storeId;
  if (userStoreId !== undefined && userStoreId !== null && !Number.isNaN(Number(userStoreId))) {
    return Number(userStoreId);
  }
  if (hasAnyRole(req.user, SUPER_ROLES)) {
    const rawStoreId = req.query.storeId;
    const queryStoreId = typeof rawStoreId === "string" ? Number(rawStoreId) : NaN;
    if (!Number.isNaN(queryStoreId) && queryStoreId > 0) {
      return queryStoreId;
    }
  }
  return null;
}

export const listAnnouncements = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const query = listQuerySchema.parse(req.query);
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const result = await retailAnnouncementService.listAnnouncementsAdmin(
    { storeId: query.storeId, keyword: query.keyword, page, pageSize },
    tenantId
  );
  res.json(ok(result));
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  const body = createAnnouncementSchema.parse(req.body);
  const storeId = resolveStoreId(req);
  if (!storeId) {
    res.status(403).json(fail("缺少门店权限", "403"));
    return;
  }
  const tenantId = req.tenantId!;
  const result = await retailAnnouncementService.createAnnouncement(
    {
      store_id: storeId,
      title: body.title,
      content: body.content,
      is_top: body.isTop ? 1 : 0,
      start_time: body.startTime ?? null,
      end_time: body.endTime ?? null,
    },
    tenantId
  );
  res.json(ok(result));
});

export const updateAnnouncement = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const body = updateAnnouncementSchema.parse(req.body);
  const storeId = resolveStoreId(req);
  if (!storeId) {
    res.status(403).json(fail("缺少门店权限", "403"));
    return;
  }
  const tenantId = req.tenantId!;
  const result = await retailAnnouncementService.updateAnnouncement(
    id,
    {
      store_id: body.storeId,
      title: body.title,
      content: body.content,
      is_top: body.isTop === undefined ? undefined : (body.isTop ? 1 : 0),
      start_time: body.startTime,
      end_time: body.endTime,
      status: body.status === undefined ? undefined : (body.status === "ENABLED" ? 1 : 0),
    },
    storeId,
    tenantId
  );
  res.json(ok(result));
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const storeId = resolveStoreId(req);
  if (!storeId) {
    res.status(403).json(fail("缺少门店权限", "403"));
    return;
  }
  const tenantId = req.tenantId!;
  await retailAnnouncementService.deleteAnnouncement(id, storeId, tenantId);
  res.json(ok({ deleted: true }));
});
