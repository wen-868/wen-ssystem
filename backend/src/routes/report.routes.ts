import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as salesReportController from "../controllers/admin/report/sales-report.controller.js";
import * as productReportController from "../controllers/admin/report/product-report.controller.js";
import * as financeReportController from "../controllers/admin/report/finance-report.controller.js";
import * as customerReportController from "../controllers/admin/report/customer-report.controller.js";

export const reportRouter = Router();

// ========== 销售报表 ==========
reportRouter.get("/sales-daily", requireAuthWithTenant, salesReportController.getSalesDaily);
reportRouter.get("/sales-ranking", requireAuthWithTenant, salesReportController.getSalesRanking);
reportRouter.get("/sales-trend", requireAuthWithTenant, salesReportController.getSalesTrend);
reportRouter.get("/business-overview", requireAuthWithTenant, salesReportController.getBusinessOverview);

// ========== 商品/库存/采购报表 ==========
reportRouter.get("/inventory-summary", requireAuthWithTenant, productReportController.getInventorySummary);
reportRouter.get("/inventory-turnover", requireAuthWithTenant, productReportController.getInventoryTurnover);
reportRouter.get("/inventory-age", requireAuthWithTenant, productReportController.getInventoryAge);
reportRouter.get("/purchase-summary", requireAuthWithTenant, productReportController.getPurchaseSummary);
reportRouter.get("/supplier-ranking", requireAuthWithTenant, productReportController.getSupplierRanking);

// ========== 财务报表 ==========
reportRouter.get("/receivable-payable", requireAuthWithTenant, financeReportController.getReceivablePayable);
reportRouter.get("/payment-analysis", requireAuthWithTenant, financeReportController.getPaymentAnalysis);
reportRouter.get("/profit", requireAuthWithTenant, financeReportController.getProfit);

// ========== 客户报表 ==========
reportRouter.get("/customer-contribution", requireAuthWithTenant, customerReportController.getCustomerContribution);
