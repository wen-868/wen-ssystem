/**
 * 系统资源监控路由
 * 前缀：/api/monitor
 */
import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/monitor-system.controller";

export const monitorSystemRouter = Router();

monitorSystemRouter.get("/system", asyncHandler(controller.getSystemResources));
monitorSystemRouter.get("/health", asyncHandler(controller.checkSystemHealth));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/monitor",
  router: monitorSystemRouter,
  auth: "requireAuth",
};
