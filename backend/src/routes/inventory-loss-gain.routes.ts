import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as inventoryLossGainController from "../controllers/admin/inventory-loss-gain.controller.js";

export const inventoryLossGainRouter = Router();

inventoryLossGainRouter.post("/report-loss-gain", requireAuthWithTenant, inventoryLossGainController.reportLossGain);
inventoryLossGainRouter.get("/loss-gains", requireAuthWithTenant, inventoryLossGainController.listLossGains);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/inventory",
  router: inventoryLossGainRouter,
  auth: "requireAuthWithTenant",
};
