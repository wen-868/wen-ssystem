import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuth } from "../middleware/auth";
import * as ctrl from "../controllers/admin/tenant.controller";

export const tenantRouter = Router();
tenantRouter.get("/", requireAuth, ctrl.listTenants);
tenantRouter.get("/:tenantId", requireAuth, ctrl.getTenantDetail);
tenantRouter.post("/", requireAuth, ctrl.createTenant);
tenantRouter.put("/:tenantId", requireAuth, ctrl.updateTenant);
tenantRouter.put("/:tenantId/status", requireAuth, ctrl.changeTenantStatus);
tenantRouter.get("/:tenantId/modules", requireAuth, ctrl.getTenantModules);
tenantRouter.put("/:tenantId/modules", requireAuth, ctrl.setTenantModules);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/tenants",
  router: tenantRouter,
  auth: "requireAuth",
};
