import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as overviewService from "../../services/platform/platform-overview.service";

// GET /api/platform/dashboard - 平台概览数据
export const getDashboard = asyncHandler(async (_req, res) => {
  const result = await overviewService.getPlatformOverview();
  res.json(ok(result));
});

// GET /api/platform/dashboard/tenants - 租户统计
export const getTenantStats = asyncHandler(async (_req, res) => {
  const result = await overviewService.getTenantStatistics();
  res.json(ok(result));
});

// GET /api/platform/dashboard/revenue - 收入统计
export const getRevenueStats = asyncHandler(async (_req, res) => {
  const result = await overviewService.getRevenueStatistics();
  res.json(ok(result));
});

// R97-01: GET /api/platform/dashboard/overview - 平台看板总览（对齐 saas-admin Dashboard.vue）
export const getDashboardOverview = asyncHandler(async (_req, res) => {
  const result = await overviewService.getPlatformDashboardOverview();
  res.json(ok(result));
});
