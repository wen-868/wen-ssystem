import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as financeDashboardService from "../../services/admin/finance-dashboard.service";

export const getFinanceDashboard = asyncHandler(async (req, res) => { res.json(ok(await financeDashboardService.getFinanceDashboard(req.tenantId!))); });
export const getDailyReport = asyncHandler(async (req, res) => { res.json(ok(await financeDashboardService.getDailyReport(req.tenantId!, req.query.startDate as string | undefined, req.query.endDate as string | undefined))); });
export const getMonthlyReport = asyncHandler(async (req, res) => { res.json(ok(await financeDashboardService.getMonthlyReport(req.tenantId!, req.query.year ? Number(req.query.year) : undefined))); });
export const getCashFlow = asyncHandler(async (req, res) => { res.json(ok(await financeDashboardService.getCashFlow(req.tenantId!, Number(req.query.months || 12)))); });
export const getProfitTrend = asyncHandler(async (req, res) => { res.json(ok(await financeDashboardService.getProfitTrend(req.tenantId!, Number(req.query.months || 12)))); });
export const getTopCustomersAR = asyncHandler(async (req, res) => { res.json(ok(await financeDashboardService.getTopCustomersAR(req.tenantId!, Number(req.query.limit || 10)))); });
export const getTopSuppliersAP = asyncHandler(async (req, res) => { res.json(ok(await financeDashboardService.getTopSuppliersAP(req.tenantId!, Number(req.query.limit || 10)))); });

export const getCashFlowDetail = asyncHandler(async (req, res) => {
  res.json(ok(await financeDashboardService.getCashFlowDetail({
    tenantId: req.tenantId!,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
    type: req.query.type as string | undefined,
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20)
  })));
});

export const getIncomeExpenseStats = asyncHandler(async (req, res) => {
  res.json(ok(await financeDashboardService.getIncomeExpenseStats(req.tenantId!, req.query.startDate as string | undefined, req.query.endDate as string | undefined)));
});

export const getIncomeByCategory = asyncHandler(async (req, res) => {
  res.json(ok(await financeDashboardService.getIncomeByCategory(req.tenantId!, req.query.startDate as string | undefined, req.query.endDate as string | undefined)));
});

export const getExpenseByCategory = asyncHandler(async (req, res) => {
  res.json(ok(await financeDashboardService.getExpenseByCategory(req.tenantId!, req.query.startDate as string | undefined, req.query.endDate as string | undefined)));
});