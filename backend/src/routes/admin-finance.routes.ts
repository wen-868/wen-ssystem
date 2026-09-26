import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

import * as dailySettlementController from "../controllers/admin/daily-settlement.controller";
import * as financeDashboardController from "../controllers/admin/finance-dashboard.controller";

export const adminFinanceRouter = Router();

// ============ 日结 ============
// 日结独立成码（S3-122-F4）：`finance:payment` 同时是提成结算/支付核销/收据核销/应收收款的权限门，
// 操作员只需「生成日结单」却被这个粗粒度码带出越权面 ⇒ 日结单改挂 `finance:daily-settle`。
// `finance:payment` 保留给其余收款类端点，不得改回。
adminFinanceRouter.post("/daily-settlements", requirePermission("finance:daily-settle"), dailySettlementController.createDailySettlement);
adminFinanceRouter.get("/daily-settlements", dailySettlementController.listDailySettlements);
adminFinanceRouter.get("/daily-settlements/:id", dailySettlementController.getDailySettlementDetail);

// ============ 财务驾驶舱 ============
adminFinanceRouter.get("/finance/dashboard", financeDashboardController.getFinanceDashboard);
adminFinanceRouter.get("/finance/daily-report", financeDashboardController.getDailyReport);
adminFinanceRouter.get("/finance/monthly-report", financeDashboardController.getMonthlyReport);
adminFinanceRouter.get("/finance/cash-flow", financeDashboardController.getCashFlow);
adminFinanceRouter.get("/finance/profit-trend", financeDashboardController.getProfitTrend);
adminFinanceRouter.get("/finance/top-customers-ar", financeDashboardController.getTopCustomersAR);
adminFinanceRouter.get("/finance/top-suppliers-ap", financeDashboardController.getTopSuppliersAP);

// ============ 资金报表 ============
adminFinanceRouter.get("/finance/cash-flow-detail", financeDashboardController.getCashFlowDetail);
adminFinanceRouter.get("/finance/income-expense-stats", financeDashboardController.getIncomeExpenseStats);
adminFinanceRouter.get("/finance/income-by-category", financeDashboardController.getIncomeByCategory);
adminFinanceRouter.get("/finance/expense-by-category", financeDashboardController.getExpenseByCategory);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminFinanceRouter,
  auth: "requireAuthWithTenant",
};