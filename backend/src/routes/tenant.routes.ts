import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as ctrl from "../controllers/admin/tenant.controller";

export const tenantRouter = Router();
tenantRouter.get("/", requireAuthWithTenant, ctrl.listTenants);
tenantRouter.get("/:tenantId", requireAuthWithTenant, ctrl.getTenantDetail);
tenantRouter.post("/", requireAuthWithTenant, ctrl.createTenant);
tenantRouter.put("/:tenantId", requireAuthWithTenant, ctrl.updateTenant);
tenantRouter.put("/:tenantId/status", requireAuthWithTenant, ctrl.changeTenantStatus);
tenantRouter.get("/:tenantId/modules", requireAuthWithTenant, ctrl.getTenantModules);
tenantRouter.put("/:tenantId/modules", requireAuthWithTenant, ctrl.setTenantModules);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/tenants",
  router: tenantRouter,
  auth: "requireAuthWithTenant",
};
