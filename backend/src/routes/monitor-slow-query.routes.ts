/**
 * 慢查询监控路由
 * 前缀：/api/monitor
 */
import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { ok } from "../shared/response";
import { getSlowQueries } from "../middleware/slow-query-monitor";

export const monitorSlowQueryRouter = Router();

// ========== 获取慢查询列表 ==========
monitorSlowQueryRouter.get(
  "/slow-queries",
  asyncHandler(async (_req, res) => {
    const queries = getSlowQueries();
    res.json(ok({ total: queries.length, items: queries }));
  })
);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/monitor",
  router: monitorSlowQueryRouter,
  auth: "requireAuth",
};
