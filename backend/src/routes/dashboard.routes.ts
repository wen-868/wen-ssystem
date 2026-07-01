import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/dashboard.controller.js";

export const dashboardRouter = Router();

dashboardRouter.get("/overview", requireAuthWithTenant, ctrl.getOverview);
dashboardRouter.get("/sales-trend", requireAuthWithTenant, ctrl.getSalesTrend);
dashboardRouter.get("/category-pie", requireAuthWithTenant, ctrl.getCategoryPie);
dashboardRouter.get("/top-products", requireAuthWithTenant, ctrl.getTopProducts);
dashboardRouter.get("/top-customers", requireAuthWithTenant, ctrl.getTopCustomers);
dashboardRouter.get("/recent-alerts", requireAuthWithTenant, ctrl.getRecentAlerts);
dashboardRouter.get("/todos", requireAuthWithTenant, ctrl.getTodos);
dashboardRouter.get("/recent-orders", requireAuthWithTenant, ctrl.getRecentOrders);
dashboardRouter.get("/sales-trend-daily", requireAuthWithTenant, ctrl.getSalesTrendByDay);