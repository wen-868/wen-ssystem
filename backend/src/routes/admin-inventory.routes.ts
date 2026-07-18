import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as reportController from "../controllers/admin/report.controller";

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
  auth: "requireAuthWithTenant",
};