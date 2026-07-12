/**
 * 慢查询监控路由
 * 前缀：/api/monitor
 */
import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/monitor-slow-query.controller";

export const monitorSlowQueryRouter = Router();

monitorSlowQueryRouter.get("/slow-queries", asyncHandler(controller.listSlowQueries));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/monitor",
  router: monitorSlowQueryRouter,
  auth: "requireAuth",
};
