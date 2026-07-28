import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as reportController from "../controllers/admin/report.controller";

export const adminInventoryRouter = Router();

// ============ 库存概览 ============
adminInventoryRouter.get("/inventory-alerts", reportController.getInventoryAlerts);
adminInventoryRouter.get("/inventory-balance", reportController.listInventoryBalance);
adminInventoryRouter.get("/inventory-logs", reportController.listInventoryLogs);

// ============ 库存报表 ============
// 注：inventory-turnover / inventory-age 已合并到 report.routes.ts（新实现按 SKU 维度计算周转天数/库龄，参数更丰富）
adminInventoryRouter.get("/reports/inventory-abc", reportController.getInventoryABC);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminInventoryRouter,
  auth: "requireAuthWithTenant",
};