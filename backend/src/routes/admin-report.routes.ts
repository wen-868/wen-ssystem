import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as reportController from "../controllers/admin/report.controller";

export const adminReportRouter = Router();

// ============ 报表/仪表盘 ============
adminReportRouter.get("/dashboard", requireAuthWithTenant, reportController.getDashboard);
adminReportRouter.get("/daily-sales-trend", requireAuthWithTenant, reportController.getDailySalesTrend);
adminReportRouter.get("/store-sales-performance", requireAuthWithTenant, reportController.getStoreSalesPerformance);
adminReportRouter.get("/collection-links", requireAuthWithTenant, reportController.listCollectionLinks);
adminReportRouter.get("/payment-orders", requireAuthWithTenant, reportController.listPaymentOrders);
adminReportRouter.get("/refund-orders", requireAuthWithTenant, reportController.listRefundOrders);

// ============ 分享链接管理 ============
adminReportRouter.get("/collection-links/stats", requireAuthWithTenant, reportController.getCollectionLinkStats);
adminReportRouter.post("/collection-links/:linkNo/revoke", requireAuthWithTenant, reportController.revokeCollectionLink);
adminReportRouter.post("/sale-bills/batch-collection-link", requireAuthWithTenant, reportController.batchCreateCollectionLinks);

// ============ 销售报表 ============
adminReportRouter.get("/reports/sales-ranking", requireAuthWithTenant, reportController.getSalesRanking);
adminReportRouter.get("/reports/product-ranking", requireAuthWithTenant, reportController.getProductRanking);
adminReportRouter.get("/reports/sales-trend", requireAuthWithTenant, reportController.getSalesTrend);

// ============ 采购报表 ============
adminReportRouter.get("/reports/purchase-summary", requireAuthWithTenant, reportController.getPurchaseSummary);
adminReportRouter.get("/reports/purchase-trend", requireAuthWithTenant, reportController.getPurchaseTrend);
adminReportRouter.get("/reports/supplier-ranking", requireAuthWithTenant, reportController.getSupplierRanking);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminReportRouter,
  auth: "requireAuthWithTenant",
};