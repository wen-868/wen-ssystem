import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/alert.controller.js";

export const alertRouter = Router();

alertRouter.get("/list", requireAuthWithTenant, ctrl.listAlerts);
alertRouter.get("/count", requireAuthWithTenant, ctrl.getAlertCounts);
alertRouter.put("/:id/handle", requireAuthWithTenant, ctrl.handleAlert);
alertRouter.get("/rules", requireAuthWithTenant, ctrl.listAlertRules);
alertRouter.put("/rules/:id", requireAuthWithTenant, ctrl.updateAlertRule);
alertRouter.post("/check", requireAuthWithTenant, ctrl.runCheck);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/alerts",
  router: alertRouter,
  auth: "requireAuthWithTenant",
};
