import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import {
  APP_PLATFORMS,
  getLatestVersion,
  listVersions,
  publishVersion,
  deleteVersion,
} from "../../services/platform/app-version.service";

/** 公开：客户端检查最新版本（无需登录） */
export const checkAppVersion = asyncHandler(async (req, res) => {
  const platform = z.enum(APP_PLATFORMS).parse(req.params.platform);
  const data = await getLatestVersion(platform);
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
