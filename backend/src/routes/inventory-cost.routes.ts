import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as inventoryCostController from "../controllers/admin/inventory-cost.controller.js";

export const inventoryCostRouter = Router();

inventoryCostRouter.get("/cost-detail", requireAuthWithTenant, inventoryCostController.getInventoryCostDetail);
inventoryCostRouter.get("/cost-trend", requireAuthWithTenant, inventoryCostController.getInventoryCostTrend);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/inventory",
  router: inventoryCostRouter,
  auth: "requireAuthWithTenant",
};
