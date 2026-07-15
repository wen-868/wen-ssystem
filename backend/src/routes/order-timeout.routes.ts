import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as ctrl from "../controllers/order-timeout.controller";
import { startOrderTimeoutScanner } from "../services/admin/order-timeout.service";

startOrderTimeoutScanner();

export const orderTimeoutRouter = Router();

orderTimeoutRouter.get("/configs", requireAuthWithTenant, ctrl.listConfigs);
orderTimeoutRouter.post("/configs", requireAuthWithTenant, ctrl.createConfig);
orderTimeoutRouter.put("/configs/:id", requireAuthWithTenant, ctrl.updateConfig);
orderTimeoutRouter.delete("/configs/:id", requireAuthWithTenant, ctrl.deleteConfig);
orderTimeoutRouter.get("/logs", requireAuthWithTenant, ctrl.listLogs);
orderTimeoutRouter.get("/statistics", requireAuthWithTenant, ctrl.getStatistics);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/order-timeout",
  router: orderTimeoutRouter,
  auth: "requireAuthWithTenant",
};
