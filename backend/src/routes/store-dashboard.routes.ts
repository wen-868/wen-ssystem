import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as authController from "../controllers/store/auth.controller";
import * as receivableController from "../controllers/store/receivable.controller";

export const storeDashboardRouter = Router();

// Auth (无需认证)
storeDashboardRouter.get("/me", authController.getMe);

// 需要认证
storeDashboardRouter.use(requireAuthWithTenant);

// 门店信息
storeDashboardRouter.get("/info", authController.getStoreInfo);

// 仪表盘
storeDashboardRouter.get("/dashboard", receivableController.getDashboard);
storeDashboardRouter.get("/daily-sales", receivableController.getDailySales);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store",
  router: storeDashboardRouter,
  auth: "requireAuthWithTenant",
};