import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as ctrl from "../controllers/rbac.controller";
export { requirePermission, checkUserPermission } from "../middleware/rbac-auth";

export const rbacRouter = Router();

rbacRouter.get("/", requireAuthWithTenant, ctrl.listRoles);
rbacRouter.post("/", requireAuthWithTenant, ctrl.createRole);
rbacRouter.get("/:id", requireAuthWithTenant, ctrl.getRoleDetail);
rbacRouter.put("/:id", requireAuthWithTenant, ctrl.updateRole);
rbacRouter.delete("/:id", requireAuthWithTenant, ctrl.deleteRole);

rbacRouter.get("/users/:userId/roles", requireAuthWithTenant, ctrl.getUserRoles);
rbacRouter.put("/users/:userId/roles", requireAuthWithTenant, ctrl.setUserRoles);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/roles",
  router: rbacRouter,
  auth: "requireAuthWithTenant",
};
