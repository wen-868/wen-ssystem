import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import {
  listConfigs,
  updateConfig,
  getPlatformSysConfig,
  updatePlatformSysConfig,
} from "../controllers/platform/platform-manage.controller";

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

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform/config",
  router: platformConfigRouter,
  auth: "requirePlatformAuth",
};
