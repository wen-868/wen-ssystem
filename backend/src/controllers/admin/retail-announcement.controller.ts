/**
 * 即时零售公告控制器
 *
 * 注意：禁止 try-catch（项目规则决策 3），错误统一由全局 errorHandler 处理。
 * 通过 asyncHandler 包装异步函数，自动捕获 Promise 异常并传递到 errorHandler。
 *
 * 安全要点（R55-01）：
 * - storeId 从 req.user.storeId 获取（JWT 关联查询，不信任用户输入）
 * - tenantId 从 req.tenantId 获取（requireAuthWithTenant 中间件注入）
 * - SUPER_ADMIN / OPERATION_ADMIN 无 storeId 时允许从 query 获取（可信超级管理员）
 * - update/delete 通过 service 层 store_id + tenant_id 双重校验
 *
 * 关联任务：R55-01 retail-announcement 跨租户数据泄露修复
 */

import { z } from "zod";
import type { Request } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import { hasAnyRole } from "../../middleware/auth";
import * as retailAnnouncementService from "../../services/instant-retail/retail-announcement.service";

const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  is_top: z.number().int().min(0).max(1).optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
});

const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
  is_top: z.number().int().min(0).max(1).optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
});

const SUPER_ROLES = ["SUPER_ADMIN", "OPERATION_ADMIN"];

/**
 * 从请求中获取门店ID（不信任用户输入）
 *
 * 规则：
 * - 普通用户：storeId 来自 req.user.storeId（JWT 关联查询）
 * - SUPER_ADMIN / OPERATION_ADMIN：无 storeId 时允许从 req.query.storeId 获取（可信超级管理员）
 * - 其他情况：返回 null，调用方返回 403
 */
function resolveStoreId(req: Request): number | null {
  const userStoreId = req.user?.storeId;
  if (userStoreId !== undefined && userStoreId !== null && !Number.isNaN(Number(userStoreId))) {
    return Number(userStoreId);
  }
  // 超级管理员无门店绑定时，允许从 query 显式指定
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
  const storeId = resolveStoreId(req);
  if (!storeId) {
    res.status(403).json(fail("缺少门店权限", "403"));
    return;
  }
  const tenantId = req.tenantId!;
  const result = await retailAnnouncementService.listAnnouncements(storeId, tenantId);
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
  const { title, content, is_top, start_time, end_time } = body;
  const result = await retailAnnouncementService.createAnnouncement(
    {
      store_id: storeId,
      title,
      content,
      is_top,
      start_time,
      end_time,
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
  const { title, content, is_top, start_time, end_time } = body;
  const result = await retailAnnouncementService.updateAnnouncement(
    id,
    { title, content, is_top, start_time, end_time },
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

/**
 * 查询活跃公告（miniapp 公开接口）
 *
 * 公开接口无认证，storeId 来自 req.query（消费者选择门店后传入）。
 * 公告为公开信息，按 store_id 过滤展示。
 */
export const getActiveAnnouncements = asyncHandler(async (req, res) => {
  const storeId = req.query.storeId ? Number(req.query.storeId) : undefined;
  if (!storeId) {
    res.status(400).json(fail("storeId is required"));
    return;
  }
  const result = await retailAnnouncementService.getActiveAnnouncements(storeId);
  res.json(ok(result));
});
