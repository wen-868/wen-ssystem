import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as reportController from "../controllers/admin/report.controller.js";

export const adminInventoryRouter = Router();

// ============ 库存概览 ============
adminInventoryRouter.get("/inventory-alerts", requireAuthWithTenant, reportController.getInventoryAlerts);
adminInventoryRouter.get("/inventory-balance", requireAuthWithTenant, reportController.listInventoryBalance);
adminInventoryRouter.get("/inventory-logs", requireAuthWithTenant, reportController.listInventoryLogs);

// ============ 库存报表 ============
adminInventoryRouter.get("/reports/inventory-turnover", requireAuthWithTenant, reportController.getInventoryTurnover);
adminInventoryRouter.get("/reports/inventory-age", requireAuthWithTenant, reportController.getInventoryAge);
adminInventoryRouter.get("/reports/inventory-abc", requireAuthWithTenant, reportController.getInventoryABC);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminInventoryRouter,
  auth: "none",
};