import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as dailySettlementController from "../controllers/admin/daily-settlement.controller";
import * as financeDashboardController from "../controllers/admin/finance-dashboard.controller";

export const adminFinanceRouter = Router();

// ============ 日结 ============
adminFinanceRouter.post("/daily-settlements", requireAuthWithTenant, dailySettlementController.createDailySettlement);
adminFinanceRouter.get("/daily-settlements", requireAuthWithTenant, dailySettlementController.listDailySettlements);
adminFinanceRouter.get("/daily-settlements/:id", requireAuthWithTenant, dailySettlementController.getDailySettlementDetail);

// ============ 财务驾驶舱 ============
adminFinanceRouter.get("/finance/dashboard", requireAuthWithTenant, financeDashboardController.getFinanceDashboard);
adminFinanceRouter.get("/finance/daily-report", requireAuthWithTenant, financeDashboardController.getDailyReport);
adminFinanceRouter.get("/finance/monthly-report", requireAuthWithTenant, financeDashboardController.getMonthlyReport);
adminFinanceRouter.get("/finance/cash-flow", requireAuthWithTenant, financeDashboardController.getCashFlow);
adminFinanceRouter.get("/finance/profit-trend", requireAuthWithTenant, financeDashboardController.getProfitTrend);
adminFinanceRouter.get("/finance/top-customers-ar", requireAuthWithTenant, financeDashboardController.getTopCustomersAR);
adminFinanceRouter.get("/finance/top-suppliers-ap", requireAuthWithTenant, financeDashboardController.getTopSuppliersAP);

// ============ 资金报表 ============
adminFinanceRouter.get("/finance/cash-flow-detail", requireAuthWithTenant, financeDashboardController.getCashFlowDetail);
adminFinanceRouter.get("/finance/income-expense-stats", requireAuthWithTenant, financeDashboardController.getIncomeExpenseStats);
adminFinanceRouter.get("/finance/income-by-category", requireAuthWithTenant, financeDashboardController.getIncomeByCategory);
adminFinanceRouter.get("/finance/expense-by-category", requireAuthWithTenant, financeDashboardController.getExpenseByCategory);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminFinanceRouter,
  auth: "requireAuthWithTenant",
};