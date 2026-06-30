import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as inventoryLossGainController from "../controllers/admin/inventory-loss-gain.controller.js";

export const inventoryLossGainRouter = Router();

inventoryLossGainRouter.post("/report-loss-gain", requireAuthWithTenant, inventoryLossGainController.reportLossGain);
inventoryLossGainRouter.get("/loss-gains", requireAuthWithTenant, inventoryLossGainController.listLossGains);