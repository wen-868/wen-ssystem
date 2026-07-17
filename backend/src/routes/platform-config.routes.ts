import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import {
  listConfigs,
  updateConfig,
} from "../controllers/platform/platform-manage.controller";

// R48-05: 平台全局配置路由，独立前缀 /api/platform/config
// 平台公告路由已迁移至 platform.routes.ts（/api/platform/announcements）
// auth 改为 requirePlatformAuth（由 auto-routes 自动挂载），删除手动 router.use
export const platformConfigRouter = Router();

// GET /api/platform/config - 全局配置列表
platformConfigRouter.get("/", listConfigs);

// PUT /api/platform/config - 更新配置
platformConfigRouter.put("/", updateConfig);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform/config",
  router: platformConfigRouter,
  auth: "requirePlatformAuth",
};
