import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as inventoryCostController from "../controllers/admin/inventory-cost.controller";

export const inventoryCostRouter = Router();

inventoryCostRouter.get("/cost-detail", inventoryCostController.getInventoryCostDetail);
inventoryCostRouter.get("/cost-trend", inventoryCostController.getInventoryCostTrend);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/inventory",
  router: inventoryCostRouter,
  auth: "requireAuthWithTenant",
};
