/**
 * 系统资源监控路由
 * 前缀：/api/monitor
 */
import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { ok } from "../shared/response.js";
import {
  getMemoryUsage,
  getCpuUsage,
  getProcessInfo,
  getSystemHealth,
} from "../services/admin/system-monitor.service.js";

export const monitorSystemRouter = Router();

// ========== 获取系统资源信息 ==========
monitorSystemRouter.get(
  "/system",
  asyncHandler(async (_req, res) => {
    const memory = getMemoryUsage();
    const cpu = getCpuUsage();
    const processInfo = getProcessInfo();
    res.json(ok({ memory, cpu, process: processInfo }));
  })
);

// ========== 综合健康检查 ==========
monitorSystemRouter.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const health = await getSystemHealth();
    res.json(ok(health));
  })
);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/monitor",
  router: monitorSystemRouter,
  auth: "requireAuth",
};
