import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as ctrl from "../controllers/admin/dashboard.controller";

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

// ========== 库存分析 ==========
dashboardRouter.get("/inventory-stats", requireAuthWithTenant, ctrl.getInventoryStats);
dashboardRouter.get("/inventory-turnover", requireAuthWithTenant, ctrl.getInventoryTurnover);
dashboardRouter.get("/inventory-warning", requireAuthWithTenant, ctrl.getInventoryWarningList);
dashboardRouter.get("/inventory-value-analysis", requireAuthWithTenant, ctrl.getInventoryValueAnalysis);

// ========== 客户分析 ==========
dashboardRouter.get("/customer-stats", requireAuthWithTenant, ctrl.getCustomerStats);
dashboardRouter.get("/customer-growth-trend", requireAuthWithTenant, ctrl.getCustomerGrowthTrend);
dashboardRouter.get("/customer-activity", requireAuthWithTenant, ctrl.getCustomerActivity);
dashboardRouter.get("/customer-category-stats", requireAuthWithTenant, ctrl.getCustomerCategoryStats);

// ========== 供应商分析 ==========
dashboardRouter.get("/supplier-stats", requireAuthWithTenant, ctrl.getSupplierStats);
dashboardRouter.get("/supplier-purchase-ranking", requireAuthWithTenant, ctrl.getSupplierPurchaseRanking);
dashboardRouter.get("/supplier-on-time-rate", requireAuthWithTenant, ctrl.getSupplierOnTimeRate);
dashboardRouter.get("/supplier-trend", requireAuthWithTenant, ctrl.getSupplierTrend);

// ========== 销售排行 - 员工 ==========
dashboardRouter.get("/top-employees", requireAuthWithTenant, ctrl.getTopEmployees);
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/dashboard",
  router: dashboardRouter,
  auth: "requireAuthWithTenant",
};
