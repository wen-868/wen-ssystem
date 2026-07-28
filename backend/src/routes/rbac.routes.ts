import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/admin/rbac.controller";
export { requirePermission, checkUserPermission } from "../middleware/rbac-auth";

export const rbacRouter = Router();

rbacRouter.get("/", ctrl.listRoles);
rbacRouter.post("/", ctrl.createRole);
rbacRouter.get("/:id", ctrl.getRoleDetail);
rbacRouter.put("/:id", ctrl.updateRole);
rbacRouter.delete("/:id", ctrl.deleteRole);
rbacRouter.put("/:id/data-permissions", ctrl.updateRolePermissions);

rbacRouter.get("/users/:userId/roles", ctrl.getUserRoles);
rbacRouter.put("/users/:userId/roles", ctrl.setUserRoles);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/system/roles",
  router: rbacRouter,
  auth: "requireAuthWithTenant",
};
