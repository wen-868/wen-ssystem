import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePlatformAuth } from "../middleware/auth";
import * as tenantController from "../controllers/saas/tenant.controller";

export const saasTenantRouter = Router();

saasTenantRouter.use(requirePlatformAuth);

saasTenantRouter.get("/", tenantController.listTenants);

saasTenantRouter.get("/:id", tenantController.getTenantDetail);

saasTenantRouter.post("/", tenantController.createTenant);

saasTenantRouter.put("/:id", tenantController.updateTenant);

saasTenantRouter.post("/:id/audit", tenantController.auditTenant);

saasTenantRouter.post("/:id/toggle-status", tenantController.toggleTenantStatus);

saasTenantRouter.get("/statistics/overview", tenantController.getTenantStatistics);

export const routeConfig: RouteConfig = {
  prefix: "/api/saas/tenants",
  router: saasTenantRouter,
  auth: "requirePlatformAuth",
};
