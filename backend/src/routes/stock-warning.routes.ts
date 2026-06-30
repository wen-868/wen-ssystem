import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as stockWarningController from "../controllers/admin/stock-warning.controller.js";

export const stockWarningRouter = Router();

stockWarningRouter.get("/", requireAuthWithTenant, stockWarningController.getStockWarnings);
stockWarningRouter.post("/config", requireAuthWithTenant, stockWarningController.batchConfigStockWarning);
stockWarningRouter.get("/configs", requireAuthWithTenant, stockWarningController.getStockWarningConfigs);