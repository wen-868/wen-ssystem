import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as stockWarningController from "../controllers/admin/stock-warning.controller";

export const stockWarningRouter = Router();

stockWarningRouter.get("/", stockWarningController.getStockWarnings);
stockWarningRouter.post("/config", stockWarningController.batchConfigStockWarning);
stockWarningRouter.get("/configs", stockWarningController.getStockWarningConfigs);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/stock-warnings",
  router: stockWarningRouter,
  auth: "requireAuthWithTenant",
};
