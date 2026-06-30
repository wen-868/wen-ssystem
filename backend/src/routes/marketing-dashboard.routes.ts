import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as dashboardController from "../controllers/admin/marketing-dashboard.controller.js";

export const marketingDashboardRouter = Router();

// ==================== 营销看板 (Admin) ====================
marketingDashboardRouter.get("/overview", requireAuthWithTenant, dashboardController.getMarketingOverview);
marketingDashboardRouter.get("/activity-stats", requireAuthWithTenant, dashboardController.getActivityStats);
marketingDashboardRouter.get("/activity-stats/:activityId", requireAuthWithTenant, dashboardController.getSingleActivityStats);
marketingDashboardRouter.get("/coupon-stats", requireAuthWithTenant, dashboardController.getCouponStats);
marketingDashboardRouter.get("/trend", requireAuthWithTenant, dashboardController.getMarketingTrend);
marketingDashboardRouter.get("/activity-ranking", requireAuthWithTenant, dashboardController.getActivityRanking);
marketingDashboardRouter.get("/activity-comparison", requireAuthWithTenant, dashboardController.getActivityComparison);