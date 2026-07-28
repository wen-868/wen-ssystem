import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as reportController from "../controllers/admin/report.controller";

export const adminReportRouter = Router();

// ============ 报表/仪表盘 ============
adminReportRouter.get("/dashboard", reportController.getDashboard);
adminReportRouter.get("/daily-sales-trend", reportController.getDailySalesTrend);
adminReportRouter.get("/store-sales-performance", reportController.getStoreSalesPerformance);
adminReportRouter.get("/collection-links", reportController.listCollectionLinks);
adminReportRouter.get("/payment-orders", reportController.listPaymentOrders);
adminReportRouter.get("/refund-orders", reportController.listRefundOrders);

// ============ 分享链接管理 ============
adminReportRouter.get("/collection-links/stats", reportController.getCollectionLinkStats);
adminReportRouter.post("/collection-links/:linkNo/revoke", reportController.revokeCollectionLink);
adminReportRouter.post("/sale-bills/batch-collection-link", reportController.batchCreateCollectionLinks);

// ============ 销售报表 ============
adminReportRouter.get("/reports/sales-ranking", reportController.getSalesRanking);
adminReportRouter.get("/reports/product-ranking", reportController.getProductRanking);
adminReportRouter.get("/reports/sales-trend", reportController.getSalesTrend);

// ============ 采购报表 ============
adminReportRouter.get("/reports/purchase-summary", reportController.getPurchaseSummary);
adminReportRouter.get("/reports/purchase-trend", reportController.getPurchaseTrend);
adminReportRouter.get("/reports/supplier-ranking", reportController.getSupplierRanking);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminReportRouter,
  auth: "requireAuthWithTenant",
};