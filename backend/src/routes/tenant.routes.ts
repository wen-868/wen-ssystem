import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/tenant.controller.js";

export const tenantRouter = Router();
tenantRouter.get("/", requireAuthWithTenant, ctrl.listTenants);
tenantRouter.get("/:tenantId", requireAuthWithTenant, ctrl.getTenantDetail);
tenantRouter.post("/", requireAuthWithTenant, ctrl.createTenant);
tenantRouter.put("/:tenantId", requireAuthWithTenant, ctrl.updateTenant);
tenantRouter.put("/:tenantId/status", requireAuthWithTenant, ctrl.changeTenantStatus);
tenantRouter.get("/:tenantId/modules", requireAuthWithTenant, ctrl.getTenantModules);
tenantRouter.put("/:tenantId/modules", requireAuthWithTenant, ctrl.setTenantModules);