import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as legacyController from "../controllers/admin/platform-reconciliation.controller";
import * as platformController from "../controllers/platform/platform-reconciliation.controller";

export const platformReconciliationRouter = Router();

// R97-01: 财务结算（平台视角，数据源 t_platform_settlement）
// 注意：/stats 必须先于 /:id 注册，避免被当作 id 捕获
platformReconciliationRouter.get("/stats", asyncHandler(platformController.getPlatformReconciliationStats));
platformReconciliationRouter.get("/", asyncHandler(platformController.listPlatformReconciliations));
platformReconciliationRouter.get("/:id", asyncHandler(platformController.getPlatformReconciliationDetail));
platformReconciliationRouter.put("/:id/settle", asyncHandler(platformController.settlePlatformReconciliation));

// 保留原租户级对账能力（POST/PUT，即时零售平台对账，saas-admin 未使用）
platformReconciliationRouter.post("/", asyncHandler(legacyController.createReconciliation));
platformReconciliationRouter.put("/:id", asyncHandler(legacyController.updateReconciliation));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/reconciliation",
  router: platformReconciliationRouter,
  auth: "requirePlatformAuth",
};
