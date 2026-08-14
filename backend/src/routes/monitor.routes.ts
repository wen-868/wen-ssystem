import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/admin/monitor.controller";

export const monitorRouter = Router();

monitorRouter.get("/db-status", ctrl.getDbStatusCtrl);
monitorRouter.get("/api-stats", ctrl.getApiStatsCtrl);
monitorRouter.get("/expiring-tenants", ctrl.getExpiringTenantsCtrl);
monitorRouter.post("/notify-expiring", ctrl.notifyExpiringTenantsCtrl);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/monitor",
  router: monitorRouter,
  auth: "requireAuthWithTenant",
};
