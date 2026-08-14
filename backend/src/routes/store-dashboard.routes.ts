import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as authController from "../controllers/store/auth.controller";
import * as receivableController from "../controllers/store/receivable.controller";
import { circuitBreaker } from "../middleware/circuit-breaker";

export const storeDashboardRouter = Router();

// Auth（认证由 auto-routes 统一添加）
storeDashboardRouter.get("/me", authController.getMe);

// 门店信息
storeDashboardRouter.get("/info", authController.getStoreInfo);

// 仪表盘
storeDashboardRouter.get("/dashboard", circuitBreaker({ key: "store-dashboard" }), receivableController.getDashboard);
storeDashboardRouter.get("/daily-sales", circuitBreaker({ key: "store-daily-sales" }), receivableController.getDailySales);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store",
  router: storeDashboardRouter,
  auth: "requireAuthWithTenant",
};
