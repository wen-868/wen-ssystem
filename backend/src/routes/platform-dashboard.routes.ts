import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePlatformAuth } from "../middleware/auth";
import { getDashboard, getTenantStats, getRevenueStats } from "../controllers/platform/dashboard.controller";

export const platformDashboardRouter = Router();

platformDashboardRouter.use(requirePlatformAuth);

// ========== 平台经营看板 ==========
// GET /api/platform/dashboard - 平台概览数据
platformDashboardRouter.get("/", getDashboard);

// GET /api/platform/dashboard/tenants - 租户统计
platformDashboardRouter.get("/tenants", getTenantStats);

// GET /api/platform/dashboard/revenue - 收入统计
platformDashboardRouter.get("/revenue", getRevenueStats);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform/dashboard",
  router: platformDashboardRouter,
  auth: "none",
};
