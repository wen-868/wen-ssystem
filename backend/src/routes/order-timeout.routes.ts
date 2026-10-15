import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { requirePermission } from "../middleware/rbac-auth";
import * as ctrl from "../controllers/order-timeout.controller";
import { startOrderTimeoutScanner } from "../services/admin/order-timeout.service";

startOrderTimeoutScanner();

export const orderTimeoutRouter = Router();

orderTimeoutRouter.get("/configs", ctrl.listConfigs);
// S3-224（第 43 项 B2 批 6 · 销售域接线）：超时配置增/改/删挂 `sale:edit`（台账域内建议码）。
// 使用者 = admin-web `order/OrderTimeoutView.vue:327/292/309`（页面 `router/index.ts:118` 角色
// = SUPER_ADMIN / STORE_MANAGER）；生产持有 `sale:edit` = SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER
// ⊇ 页面角色 ⇒ 零回归（app-mobile / miniapp / saas-admin 全仓无调用点）。2026-10-16
orderTimeoutRouter.post("/configs", requirePermission("sale:edit"), ctrl.createConfig);
orderTimeoutRouter.put("/configs/:id", requirePermission("sale:edit"), ctrl.updateConfig);
orderTimeoutRouter.delete("/configs/:id", requirePermission("sale:edit"), ctrl.deleteConfig);
orderTimeoutRouter.get("/logs", ctrl.listLogs);
orderTimeoutRouter.get("/statistics", ctrl.getStatistics);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/order-timeout",
  router: orderTimeoutRouter,
  auth: "requireAuthWithTenant",
};
