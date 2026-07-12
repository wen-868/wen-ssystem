import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

/**
 * 授信管理路由
 * 当前暂无活跃端点
 */
export const adminCreditRouter = Router();

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminCreditRouter,
  auth: "none",
};