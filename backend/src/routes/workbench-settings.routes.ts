import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";
import * as ctrl from "../controllers/admin/workbench-settings.controller";

export const workbenchSettingsRouter = Router();

workbenchSettingsRouter.get("/me", ctrl.getMySettings);
workbenchSettingsRouter.put("/me", ctrl.saveMySettings);
workbenchSettingsRouter.post("/me/reset", ctrl.resetMySettings);

workbenchSettingsRouter.get("/tenant", ctrl.getTenantSettings);
workbenchSettingsRouter.put("/tenant", requirePermission("system:config"), ctrl.saveTenantSettings);
workbenchSettingsRouter.post("/tenant/reset", requirePermission("system:config"), ctrl.resetTenantSettings);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/workbench-settings",
  router: workbenchSettingsRouter,
  auth: "requireAuthWithTenant",
};
