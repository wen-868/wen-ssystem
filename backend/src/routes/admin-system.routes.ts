import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

/**
 * 系统设置路由
 * 当前暂无活跃端点（auth 相关路由已移至 server.ts 单独挂载）
 */
export const adminSystemRouter = Router();

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminSystemRouter,
  auth: "none",
};