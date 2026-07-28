import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as dashboardController from "../controllers/admin/marketing-dashboard.controller";

export const marketingDashboardRouter = Router();

// ==================== 营销看板 (Admin) ====================
marketingDashboardRouter.get("/overview", dashboardController.getMarketingOverview);
marketingDashboardRouter.get("/activity-stats", dashboardController.getActivityStats);
marketingDashboardRouter.get("/activity-stats/:activityId", dashboardController.getSingleActivityStats);
marketingDashboardRouter.get("/coupon-stats", dashboardController.getCouponStats);
marketingDashboardRouter.get("/trend", dashboardController.getMarketingTrend);
marketingDashboardRouter.get("/activity-ranking", dashboardController.getActivityRanking);
marketingDashboardRouter.get("/activity-comparison", dashboardController.getActivityComparison);
marketingDashboardRouter.get("/activity-effect/:activityId", dashboardController.getActivityEffectAnalysis);
marketingDashboardRouter.get("/activity-conversion-trend/:activityId", dashboardController.getActivityConversionTrend);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing/dashboard",
  router: marketingDashboardRouter,
  auth: "requireAuthWithTenant",
};
