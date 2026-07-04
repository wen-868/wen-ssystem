import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/admin/error-log.controller.js";

export const errorLogRouter = Router();

errorLogRouter.post("/error-report", requireAuthWithTenant, ctrl.reportFrontendError);
errorLogRouter.get("/error-logs", requireAuthWithTenant, ctrl.listErrorLogs);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: errorLogRouter,
  auth: "none",
};
