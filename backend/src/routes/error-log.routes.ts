import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/admin/error-log.controller";

export const errorLogRouter = Router();

errorLogRouter.post("/error-report", ctrl.reportFrontendError);
errorLogRouter.get("/error-logs", ctrl.listErrorLogs);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: errorLogRouter,
  auth: "requireAuthWithTenant",
};
