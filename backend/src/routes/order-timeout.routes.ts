import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/order-timeout.controller.js";

export const orderTimeoutRouter = Router();

orderTimeoutRouter.get("/configs", requireAuthWithTenant, ctrl.listConfigs);
orderTimeoutRouter.post("/configs", requireAuthWithTenant, ctrl.createConfig);
orderTimeoutRouter.put("/configs/:id", requireAuthWithTenant, ctrl.updateConfig);
orderTimeoutRouter.delete("/configs/:id", requireAuthWithTenant, ctrl.deleteConfig);
orderTimeoutRouter.get("/logs", requireAuthWithTenant, ctrl.listLogs);
orderTimeoutRouter.get("/statistics", requireAuthWithTenant, ctrl.getStatistics);