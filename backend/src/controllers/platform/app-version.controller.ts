import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import {
  APP_PLATFORMS,
  archiveVersion,
  getLatestVersion,
  listVersions,
  pauseVersion,
  publishVersion,
  resumeVersion,
  rollbackVersion,
  saveDraftVersion,
  deleteVersion,
} from "../../services/platform/app-version.service";
import type { AppVersionOperator } from "../../services/platform/app-version.service";

/** 公开：客户端检查最新版本（无需登录） */
export const checkAppVersion = asyncHandler(async (req, res) => {
  const platform = z.enum(APP_PLATFORMS).parse(req.params.platform);
  const arch = typeof req.query.arch === "string" ? req.query.arch : undefined;
  const data = await getLatestVersion(platform, arch);
  res.json(ok(data));
});

/** 总台：版本列表 */
export const listAppVersions = asyncHandler(async (req, res) => {
  const platform = (req.query.platform as string) || undefined;
  if (platform && !(APP_PLATFORMS as readonly string[]).includes(platform)) {
    res.json(ok([]));
    return;
  }
  const data = await listVersions(platform);
  res.json(ok(data));
});

/** 总台：发布/更新版本 */
export const createAppVersion = asyncHandler(async (req, res) => {
  const body = z.object({
    platform: z.enum(APP_PLATFORMS),
    versionCode: z.number().int().positive(),
    versionName: z.string().min(1).max(32),
    minVersionCode: z.number().int().min(0).default(0),
    isForce: z.boolean().default(false),
    updateUrl: z.string().max(512).default(""),
    updateUrlX64: z.string().max(512).default(""),
    updateUrlIa32: z.string().max(512).default(""),
    updateUrlArm64: z.string().max(512).default(""),
    packageUrl: z.string().max(512).default(""),
    updateNote: z.string().max(2000).default(""),
    enabled: z.boolean().default(true),
  }).parse(req.body);
  const data = await publishVersion(body);
  res.json(ok(data));
});

/** 总台：删除版本 */
export const removeAppVersion = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const data = await deleteVersion(id);
  res.json(ok(data));
});

// ─── C6-1A：草稿 / 暂停放量 / 继续放量 / 归档 / 回滚（178 迁移加列后可用） ──────

/** 操作人上下文：从 requirePlatformAuth 解出的 req.user 取（写 t_platform_audit_log 留痕） */
function operatorOf(req: any): AppVersionOperator {
  return {
    adminId: Number(req.user?.id ?? 0),
    adminName: String(req.user?.realName || req.user?.username || "platform"),
    ip: req.ip ?? null
  };
}

/** 从 :id 取版本主键（非正整数直接 400，不进入服务层） */
function versionIdOf(req: any, res: any): number | null {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json(fail("版本 ID 不合法", "400"));
    return null;
  }
  return id;
}

/**
 * POST /api/padmin/app-versions/draft —— 保存版本草稿
 * 清账依据：C6-0 §三.1 #34（AppVersions.vue:362）「无草稿保存端点」。
 */
export const saveAppVersionDraft = asyncHandler(async (req, res) => {
  const body = z.object({
    platform: z.enum(APP_PLATFORMS),
    versionCode: z.number().int().positive(),
    versionName: z.string().min(1).max(32),
    minVersionCode: z.number().int().min(0).default(0),
    isForce: z.boolean().default(false),
    updateUrl: z.string().max(512).default(""),
    updateUrlX64: z.string().max(512).default(""),
    updateUrlIa32: z.string().max(512).default(""),
    updateUrlArm64: z.string().max(512).default(""),
    packageUrl: z.string().max(512).default(""),
    updateNote: z.string().max(2000).default("")
  }).parse(req.body);
  const data = await saveDraftVersion(body);
  res.json(ok(data));
});

/** POST /api/padmin/app-versions/:id/pause —— 暂停放量（#36） */
export const pauseAppVersion = asyncHandler(async (req, res) => {
  const id = versionIdOf(req, res);
  if (id === null) return;
  const data = await pauseVersion(id, operatorOf(req));
  res.json(ok(data));
});

/** POST /api/padmin/app-versions/:id/resume —— 继续放量（#36） */
export const resumeAppVersion = asyncHandler(async (req, res) => {
  const id = versionIdOf(req, res);
  if (id === null) return;
  const data = await resumeVersion(id, operatorOf(req));
  res.json(ok(data));
});

/** POST /api/padmin/app-versions/:id/archive —— 归档（#36） */
export const archiveAppVersion = asyncHandler(async (req, res) => {
  const id = versionIdOf(req, res);
  if (id === null) return;
  const data = await archiveVersion(id, operatorOf(req));
  res.json(ok(data));
});

/** POST /api/padmin/app-versions/:id/rollback —— 回滚到指定已发布版本（#39，口径见裁定 R5②） */
export const rollbackAppVersion = asyncHandler(async (req, res) => {
  const id = versionIdOf(req, res);
  if (id === null) return;
  const data = await rollbackVersion(id, operatorOf(req));
  res.json(ok(data));
});
