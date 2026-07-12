import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as dashboardController from "../controllers/admin/marketing-dashboard.controller";

export const marketingDashboardRouter = Router();

// ==================== 营销看板 (Admin) ====================
marketingDashboardRouter.get("/overview", requireAuthWithTenant, dashboardController.getMarketingOverview);
marketingDashboardRouter.get("/activity-stats", requireAuthWithTenant, dashboardController.getActivityStats);
marketingDashboardRouter.get("/activity-stats/:activityId", requireAuthWithTenant, dashboardController.getSingleActivityStats);
marketingDashboardRouter.get("/coupon-stats", requireAuthWithTenant, dashboardController.getCouponStats);
marketingDashboardRouter.get("/trend", requireAuthWithTenant, dashboardController.getMarketingTrend);
marketingDashboardRouter.get("/activity-ranking", requireAuthWithTenant, dashboardController.getActivityRanking);
marketingDashboardRouter.get("/activity-comparison", requireAuthWithTenant, dashboardController.getActivityComparison);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing/dashboard",
  router: marketingDashboardRouter,
  auth: "requireAuthWithTenant",
};
