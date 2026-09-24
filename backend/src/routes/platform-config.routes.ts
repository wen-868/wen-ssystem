import { Router } from "express";
import multer from "multer";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import {
  listConfigs,
  updateConfig,
  getPlatformSysConfig,
  updatePlatformSysConfig,
} from "../controllers/platform/platform-manage.controller";
import { uploadPlatformLogo } from "../controllers/platform/platform-logo.controller";

/**
 * C6-1A #80：平台 Logo 上传（复用既有上传范式，裁定 C6-0-R4 不引入 OSS）
 * 字段名兼容 file / logo，单文件、5MB 上限（与商品图同口径）。
 */
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
}).fields([
  { name: "file", maxCount: 1 },
  { name: "logo", maxCount: 1 }
]);

// R48-05: 平台全局配置路由，独立前缀 /api/platform/config
// 平台公告路由已迁移至 platform.routes.ts（/api/platform/announcements）
// auth 改为 requirePlatformAuth（由 auto-routes 自动挂载），删除手动 router.use
export const platformConfigRouter = Router();

// GET /api/platform/config - 全局配置列表
platformConfigRouter.get("/", listConfigs);

// PUT /api/platform/config - 更新配置
platformConfigRouter.put("/", updateConfig);

// R97-01: GET /api/platform/config/sys-config - 平台系统设置（saas-admin Settings.vue）
platformConfigRouter.get("/sys-config", asyncHandler(getPlatformSysConfig));

// R97-01: PUT /api/platform/config/sys-config - 保存平台系统设置
platformConfigRouter.put("/sys-config", asyncHandler(updatePlatformSysConfig));

// C6-1A #80: POST /api/platform/config/logo - 上传平台 Logo（只落盘返回 URL，不写 t_platform_config）
// 注意：具体路径写在 "/" 之外，避免与 GET/PUT / 的挂载冲突
platformConfigRouter.post("/logo", logoUpload, uploadPlatformLogo);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform/config",
  router: platformConfigRouter,
  auth: "requirePlatformAuth",
};
