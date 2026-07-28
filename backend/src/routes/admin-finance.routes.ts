import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as dailySettlementController from "../controllers/admin/daily-settlement.controller";
import * as financeDashboardController from "../controllers/admin/finance-dashboard.controller";

export const adminFinanceRouter = Router();

// ============ 日结 ============
adminFinanceRouter.post("/daily-settlements", dailySettlementController.createDailySettlement);
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