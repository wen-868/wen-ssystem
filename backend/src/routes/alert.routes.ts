import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/admin/alert.controller";

export const alertRouter = Router();

alertRouter.get("/list", ctrl.listAlerts);
alertRouter.get("/count", ctrl.getAlertCounts);
alertRouter.put("/:id/handle", ctrl.handleAlert);
alertRouter.get("/rules", ctrl.listAlertRules);
alertRouter.put("/rules/:id", ctrl.updateAlertRule);
alertRouter.post("/check", ctrl.runCheck);
// ========== ·���Զ��������� ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/alerts",
  router: alertRouter,
  auth: "requireAuthWithTenant",
};
