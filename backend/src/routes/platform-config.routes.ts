import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePlatformAuth } from "../middleware/auth";
import {
  listConfigs,
  updateConfig,
  listAnnouncements,
  createAnnouncement
} from "../controllers/platform/platform-manage.controller";

export const platformConfigRouter = Router();

platformConfigRouter.use(requirePlatformAuth);

// ========== 平台全局配置 ==========
// GET /api/platform/config - 全局配置列表
platformConfigRouter.get("/config", listConfigs);

// PUT /api/platform/config - 更新配置
platformConfigRouter.put("/config", updateConfig);

// ========== 平台公告 ==========
// GET /api/platform/announcements - 公告列表
platformConfigRouter.get("/announcements", listAnnouncements);

// POST /api/platform/announcements - 发布公告
platformConfigRouter.post("/announcements", createAnnouncement);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform",
  router: platformConfigRouter,
  auth: "none",
};
