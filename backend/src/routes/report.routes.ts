import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as salesReportController from "../controllers/admin/report/sales-report.controller";
import * as customerReportController from "../controllers/admin/report/customer-report.controller";
import * as productReportController from "../controllers/admin/report/product-report.controller";
import * as financeReportController from "../controllers/admin/report/finance-report.controller";
import * as staffReportController from "../controllers/admin/report/staff-report.controller";
import * as reportCollectionController from "../controllers/admin/report-collection.controller";
import * as reportCustomerController from "../controllers/admin/report-customer.controller";
import * as reportExportController from "../controllers/admin/report-export.controller";

export const reportRouter = Router();

// 销售报表
reportRouter.get("/sales-daily", salesReportController.getSalesDaily);
reportRouter.get("/sales-ranking", salesReportController.getSalesRanking);
reportRouter.get("/sales-trend", salesReportController.getSalesTrend);
reportRouter.get("/sales-hourly-heatmap", salesReportController.getSalesHourlyHeatmap);
reportRouter.get("/business-overview", salesReportController.getBusinessOverview);

// 客户报表
reportRouter.get("/customer-contribution", customerReportController.getCustomerContribution);

// 采购 & 库存报表
reportRouter.get("/purchase-summary", productReportController.getPurchaseSummary);
reportRouter.get("/supplier-ranking", productReportController.getSupplierRanking);
reportRouter.get("/inventory-summary", productReportController.getInventorySummary);
reportRouter.get("/inventory-turnover", productReportController.getInventoryTurnover);
reportRouter.get("/inventory-age", productReportController.getInventoryAge);

// 财务报表
reportRouter.get("/receivable-payable", financeReportController.getReceivablePayable);
reportRouter.get("/payment-analysis", financeReportController.getPaymentAnalysis);
reportRouter.get("/profit", financeReportController.getProfit);

// 员工报表
reportRouter.get("/staff-performance", staffReportController.getStaffPerformanceRanking);

// ==================== Phase 9: 收款报表 ====================
reportRouter.get("/collection/funnel", reportCollectionController.getCollectionFunnel);
reportRouter.get("/collection/channel-conversion", reportCollectionController.getChannelConversion);
reportRouter.get("/collection/timeout", reportCollectionController.getCollectionTimeout);
reportRouter.get("/collection/daily-trend", reportCollectionController.getCollectionDailyTrend);
reportRouter.get("/collection/summary", reportCollectionController.getCollectionSummary);
reportRouter.get("/collection/refund-analysis", reportCollectionController.getRefundAnalysis);

// ==================== Phase 9: 客户分析报表 ====================
reportRouter.get("/customer/repurchase", reportCustomerController.getRepurchaseAnalysis);
reportRouter.get("/customer/avg-order-value", reportCustomerController.getAvgOrderValueDistribution);
reportRouter.get("/customer/rfm", reportCustomerController.getRFMAnalysis);
reportRouter.get("/customer/contribution-ranking", reportCustomerController.getCustomerContributionRanking);
reportRouter.get("/customer/new-customer-trend", reportCustomerController.getNewCustomerTrend);
reportRouter.get("/customer/lost-customer", reportCustomerController.getLostCustomerAnalysis);

// ==================== Phase 9: 报表导出 ====================
reportRouter.post("/export", reportExportController.exportReport);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/reports",
  router: reportRouter,
  auth: "requireAuthWithTenant",
};
