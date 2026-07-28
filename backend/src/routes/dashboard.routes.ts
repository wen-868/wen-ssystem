import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/admin/dashboard.controller";

export const dashboardRouter = Router();

dashboardRouter.get("/overview", ctrl.getOverview);
dashboardRouter.get("/sales-trend", ctrl.getSalesTrend);
dashboardRouter.get("/category-pie", ctrl.getCategoryPie);
dashboardRouter.get("/top-products", ctrl.getTopProducts);
dashboardRouter.get("/top-customers", ctrl.getTopCustomers);
dashboardRouter.get("/recent-alerts", ctrl.getRecentAlerts);
dashboardRouter.get("/todos", ctrl.getTodos);
dashboardRouter.get("/recent-orders", ctrl.getRecentOrders);
dashboardRouter.get("/sales-trend-daily", ctrl.getSalesTrendByDay);

// ========== 库存分析 ==========
dashboardRouter.get("/inventory-stats", ctrl.getInventoryStats);
dashboardRouter.get("/inventory-turnover", ctrl.getInventoryTurnover);
dashboardRouter.get("/inventory-warning", ctrl.getInventoryWarningList);
dashboardRouter.get("/inventory-value-analysis", ctrl.getInventoryValueAnalysis);

// ========== 客户分析 ==========
dashboardRouter.get("/customer-stats", ctrl.getCustomerStats);
dashboardRouter.get("/customer-growth-trend", ctrl.getCustomerGrowthTrend);
dashboardRouter.get("/customer-activity", ctrl.getCustomerActivity);
dashboardRouter.get("/customer-category-stats", ctrl.getCustomerCategoryStats);

// ========== 供应商分析 ==========
dashboardRouter.get("/supplier-stats", ctrl.getSupplierStats);
dashboardRouter.get("/supplier-purchase-ranking", ctrl.getSupplierPurchaseRanking);
dashboardRouter.get("/supplier-on-time-rate", ctrl.getSupplierOnTimeRate);
dashboardRouter.get("/supplier-trend", ctrl.getSupplierTrend);

// ========== 销售排行 - 员工 ==========
dashboardRouter.get("/top-employees", ctrl.getTopEmployees);
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/dashboard",
  router: dashboardRouter,
  auth: "requireAuthWithTenant",
};
