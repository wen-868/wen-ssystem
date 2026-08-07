import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as configService from "../../services/platform/platform-config.service";
import * as announcementService from "../../services/platform/platform-announcement.service";
import * as sysConfigService from "../../services/platform/platform-sys-config.service";

// ─── 平台全局配置 ────────────────────────────────────────────

// GET /api/platform/config - 全局配置列表
export const listConfigs = asyncHandler(async (req, res) => {
  const category = req.query.category as string | undefined;
  const result = await configService.listPlatformConfigs(category);
  res.json(ok(result));
});

// PUT /api/platform/config - 更新配置
export const updateConfig = asyncHandler(async (req, res) => {
  const body = z.object({
    key: z.string().min(1),
    value: z.string(),
  }).parse(req.body);

  const result = await configService.updatePlatformConfig(
    body.key,
    body.value,
    "platform"
  );
  res.json(ok(result));
});

// R97-01: GET /api/platform/config/sys-config - 平台系统设置（saas-admin Settings.vue）
export const getPlatformSysConfig = asyncHandler(async (_req, res) => {
  const result = await sysConfigService.getSysConfig();
  res.json(ok(result));
});

// R97-01: PUT /api/platform/config/sys-config - 保存平台系统设置
export const updatePlatformSysConfig = asyncHandler(async (req, res) => {
  const body = z.record(z.string(), z.unknown()).default({}).parse(req.body ?? {});
  const result = await sysConfigService.updateSysConfig(body, "platform");
  res.json(ok(result));
});

// ─── 平台公告 ────────────────────────────────────────────────

// GET /api/platform/announcements - 公告列表
export const listAnnouncements = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const status = req.query.status as string | undefined;
  const type = req.query.type as string | undefined;

  const result = await announcementService.listAnnouncements({
    status, type, page, pageSize
  });
  res.json(ok(result));
});

// POST /api/platform/announcements - 发布公告
export const createAnnouncement = asyncHandler(async (req, res) => {
  const body = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    type: z.enum(["NOTICE", "UPDATE", "MAINTENANCE", "URGENT"]).default("NOTICE"),
    topFlag: z.number().int().min(0).max(1).default(0),
  }).parse(req.body);

  const result = await announcementService.createAnnouncement({
    ...body,
    createdBy: req.user?.id,
  });
  res.json(ok(result));
});
