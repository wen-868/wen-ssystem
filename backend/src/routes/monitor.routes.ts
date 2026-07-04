import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/admin/monitor.controller.js";

export const monitorRouter = Router();

monitorRouter.get("/db-status", requireAuthWithTenant, ctrl.getDbStatusCtrl);
monitorRouter.get("/api-stats", requireAuthWithTenant, ctrl.getApiStatsCtrl);
monitorRouter.get("/expiring-tenants", requireAuthWithTenant, ctrl.getExpiringTenantsCtrl);
monitorRouter.post("/notify-expiring", requireAuthWithTenant, ctrl.notifyExpiringTenantsCtrl);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/monitor",
  router: monitorRouter,
  auth: "requireAuthWithTenant",
};
