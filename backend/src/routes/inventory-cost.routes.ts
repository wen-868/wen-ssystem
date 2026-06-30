import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as inventoryCostController from "../controllers/admin/inventory-cost.controller.js";

export const inventoryCostRouter = Router();

inventoryCostRouter.get("/cost-detail", requireAuthWithTenant, inventoryCostController.getInventoryCostDetail);
inventoryCostRouter.get("/cost-trend", requireAuthWithTenant, inventoryCostController.getInventoryCostTrend);