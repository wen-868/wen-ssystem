import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePlatformAuth } from "../middleware/auth";
import * as ctrl from "../controllers/admin/tenant.controller";

export const tenantRouter = Router();
tenantRouter.get("/", requirePlatformAuth, ctrl.listTenants);
tenantRouter.get("/:tenantId", requirePlatformAuth, ctrl.getTenantDetail);
tenantRouter.post("/", requirePlatformAuth, ctrl.createTenant);
tenantRouter.put("/:tenantId", requirePlatformAuth, ctrl.updateTenant);
tenantRouter.put("/:tenantId/status", requirePlatformAuth, ctrl.changeTenantStatus);
tenantRouter.get("/:tenantId/modules", requirePlatformAuth, ctrl.getTenantModules);
tenantRouter.put("/:tenantId/modules", requirePlatformAuth, ctrl.setTenantModules);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform/tenants-management",
  router: tenantRouter,
  auth: "requirePlatformAuth",
};
