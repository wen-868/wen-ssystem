import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

import * as stockWarningController from "../controllers/admin/stock-warning.controller";

export const stockWarningRouter = Router();

stockWarningRouter.get("/", stockWarningController.getStockWarnings);
// S3-233（B 类收编第一批 · 库存/追溯域）：预警阈值批量配置挂 `inventory:adjust`（库存参数调整）。
// 依据门 = permission-gates.ts 的 `fx-stock-warning`（功能中心「库存预警」入口 +「我的」页快捷入口）。
// 使用者：店长（`inventory:*`）不受影响；店员（`inventory:view`）看不到该入口。
stockWarningRouter.post("/config", requirePermission("inventory:adjust"), stockWarningController.batchConfigStockWarning);
stockWarningRouter.get("/configs", stockWarningController.getStockWarningConfigs);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/stock-warnings",
  router: stockWarningRouter,
  auth: "requireAuthWithTenant",
};
