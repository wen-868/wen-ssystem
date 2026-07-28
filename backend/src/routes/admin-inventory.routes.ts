import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as reportController from "../controllers/admin/report.controller";

export const adminInventoryRouter = Router();

// ============ 库存概览 ============
adminInventoryRouter.get("/inventory-alerts", reportController.getInventoryAlerts);
adminInventoryRouter.get("/inventory-balance", reportController.listInventoryBalance);
adminInventoryRouter.get("/inventory-logs", reportController.listInventoryLogs);

// ============ 库存报表 ============
adminInventoryRouter.get("/reports/inventory-turnover", reportController.getInventoryTurnover);
adminInventoryRouter.get("/reports/inventory-age", reportController.getInventoryAge);
adminInventoryRouter.get("/reports/inventory-abc", reportController.getInventoryABC);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminInventoryRouter,
  auth: "requireAuthWithTenant",
};