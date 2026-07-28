import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/order-timeout.controller";
import { startOrderTimeoutScanner } from "../services/admin/order-timeout.service";

startOrderTimeoutScanner();

export const orderTimeoutRouter = Router();

orderTimeoutRouter.get("/configs", ctrl.listConfigs);
orderTimeoutRouter.post("/configs", ctrl.createConfig);
orderTimeoutRouter.put("/configs/:id", ctrl.updateConfig);
orderTimeoutRouter.delete("/configs/:id", ctrl.deleteConfig);
orderTimeoutRouter.get("/logs", ctrl.listLogs);
orderTimeoutRouter.get("/statistics", ctrl.getStatistics);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/order-timeout",
  router: orderTimeoutRouter,
  auth: "requireAuthWithTenant",
};
