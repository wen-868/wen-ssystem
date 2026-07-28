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
// 注：sales-ranking / sales-trend 已合并到 report.routes.ts（新实现支持 product/customer/staff 三维度聚合 + limit + 自动时间窗口）
adminReportRouter.get("/reports/product-ranking", reportController.getProductRanking);

// ============ 采购报表 ============
// 注：purchase-summary / supplier-ranking 已合并到 report.routes.ts（新实现多了 limit 参数，参数命名统一为 dateStart/dateEnd）
adminReportRouter.get("/reports/purchase-trend", reportController.getPurchaseTrend);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminReportRouter,
  auth: "requireAuthWithTenant",
};