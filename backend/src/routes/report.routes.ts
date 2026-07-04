import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as salesReportController from "../controllers/admin/report/sales-report.controller.js";
import * as customerReportController from "../controllers/admin/report/customer-report.controller.js";
import * as productReportController from "../controllers/admin/report/product-report.controller.js";
import * as financeReportController from "../controllers/admin/report/finance-report.controller.js";
import * as staffReportController from "../controllers/admin/report/staff-report.controller.js";
import * as reportCollectionController from "../controllers/admin/report-collection.controller.js";
import * as reportCustomerController from "../controllers/admin/report-customer.controller.js";
import * as reportExportController from "../controllers/admin/report-export.controller.js";

export const reportRouter = Router();

// 销售报表
reportRouter.get("/sales-daily", requireAuthWithTenant, salesReportController.getSalesDaily);
reportRouter.get("/sales-ranking", requireAuthWithTenant, salesReportController.getSalesRanking);
reportRouter.get("/sales-trend", requireAuthWithTenant, salesReportController.getSalesTrend);
reportRouter.get("/business-overview", requireAuthWithTenant, salesReportController.getBusinessOverview);

// 客户报表
reportRouter.get("/customer-contribution", requireAuthWithTenant, customerReportController.getCustomerContribution);

// 采购 & 库存报表
reportRouter.get("/purchase-summary", requireAuthWithTenant, productReportController.getPurchaseSummary);
reportRouter.get("/supplier-ranking", requireAuthWithTenant, productReportController.getSupplierRanking);
reportRouter.get("/inventory-summary", requireAuthWithTenant, productReportController.getInventorySummary);
reportRouter.get("/inventory-turnover", requireAuthWithTenant, productReportController.getInventoryTurnover);
reportRouter.get("/inventory-age", requireAuthWithTenant, productReportController.getInventoryAge);

// 财务报表
reportRouter.get("/receivable-payable", requireAuthWithTenant, financeReportController.getReceivablePayable);
reportRouter.get("/payment-analysis", requireAuthWithTenant, financeReportController.getPaymentAnalysis);
reportRouter.get("/profit", requireAuthWithTenant, financeReportController.getProfit);

// 员工报表
reportRouter.get("/staff-performance", requireAuthWithTenant, staffReportController.getStaffPerformanceRanking);

// ==================== Phase 9: 收款报表 ====================
reportRouter.get("/collection/funnel", requireAuthWithTenant, reportCollectionController.getCollectionFunnel);
reportRouter.get("/collection/channel-conversion", requireAuthWithTenant, reportCollectionController.getChannelConversion);
reportRouter.get("/collection/timeout", requireAuthWithTenant, reportCollectionController.getCollectionTimeout);
reportRouter.get("/collection/daily-trend", requireAuthWithTenant, reportCollectionController.getCollectionDailyTrend);
reportRouter.get("/collection/summary", requireAuthWithTenant, reportCollectionController.getCollectionSummary);

// ==================== Phase 9: 客户分析报表 ====================
reportRouter.get("/customer/repurchase", requireAuthWithTenant, reportCustomerController.getRepurchaseAnalysis);
reportRouter.get("/customer/avg-order-value", requireAuthWithTenant, reportCustomerController.getAvgOrderValueDistribution);
reportRouter.get("/customer/rfm", requireAuthWithTenant, reportCustomerController.getRFMAnalysis);
reportRouter.get("/customer/contribution-ranking", requireAuthWithTenant, reportCustomerController.getCustomerContributionRanking);
reportRouter.get("/customer/new-customer-trend", requireAuthWithTenant, reportCustomerController.getNewCustomerTrend);
reportRouter.get("/customer/lost-customer", requireAuthWithTenant, reportCustomerController.getLostCustomerAnalysis);

// ==================== Phase 9: 报表导出 ====================
reportRouter.post("/export", requireAuthWithTenant, reportExportController.exportReport);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/reports",
  router: reportRouter,
  auth: "requireAuthWithTenant",
};
