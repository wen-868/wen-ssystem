import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as financeDashboardService from "../../services/admin/finance-dashboard.service.js";

export const getFinanceDashboard = asyncHandler(async (req, res) => { res.json(ok(await financeDashboardService.getFinanceDashboard(req.tenantId!))); });
export const getDailyReport = asyncHandler(async (req, res) => { res.json(ok(await financeDashboardService.getDailyReport(req.tenantId!, req.query.startDate as string | undefined, req.query.endDate as string | undefined))); });
export const getMonthlyReport = asyncHandler(async (req, res) => { res.json(ok(await financeDashboardService.getMonthlyReport(req.tenantId!, req.query.year ? Number(req.query.year) : undefined))); });
export const getCashFlow = asyncHandler(async (req, res) => { res.json(ok(await financeDashboardService.getCashFlow(req.tenantId!, Number(req.query.months || 12)))); });
export const getProfitTrend = asyncHandler(async (req, res) => { res.json(ok(await financeDashboardService.getProfitTrend(req.tenantId!, Number(req.query.months || 12)))); });
export const getTopCustomersAR = asyncHandler(async (req, res) => { res.json(ok(await financeDashboardService.getTopCustomersAR(req.tenantId!, Number(req.query.limit || 10)))); });
export const getTopSuppliersAP = asyncHandler(async (req, res) => { res.json(ok(await financeDashboardService.getTopSuppliersAP(req.tenantId!, Number(req.query.limit || 10)))); });