import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as stockWarningController from "../controllers/admin/stock-warning.controller";

export const stockWarningRouter = Router();

stockWarningRouter.get("/", requireAuthWithTenant, stockWarningController.getStockWarnings);
stockWarningRouter.post("/config", requireAuthWithTenant, stockWarningController.batchConfigStockWarning);
stockWarningRouter.get("/configs", requireAuthWithTenant, stockWarningController.getStockWarningConfigs);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/stock-warnings",
  router: stockWarningRouter,
  auth: "requireAuthWithTenant",
};
