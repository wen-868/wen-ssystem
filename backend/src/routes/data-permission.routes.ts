import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as ctrl from "../controllers/admin/data-permission.controller";

export const dataPermissionRouter = Router();

dataPermissionRouter.get("/", requireAuthWithTenant, ctrl.listDataPermissions);
dataPermissionRouter.post("/", requireAuthWithTenant, ctrl.createDataPermission);
dataPermissionRouter.get("/:id", requireAuthWithTenant, ctrl.getDataPermissionDetail);
dataPermissionRouter.put("/:id", requireAuthWithTenant, ctrl.updateDataPermission);
dataPermissionRouter.delete("/:id", requireAuthWithTenant, ctrl.deleteDataPermission);

dataPermissionRouter.get("/roles/:roleId", requireAuthWithTenant, ctrl.getRoleDataPermissions);
dataPermissionRouter.post("/roles/:roleId", requireAuthWithTenant, ctrl.assignRoleDataPermission);
dataPermissionRouter.delete("/roles/:roleId/:dataPermissionId", requireAuthWithTenant, ctrl.removeRoleDataPermission);

dataPermissionRouter.get("/users/:userId", requireAuthWithTenant, ctrl.getUserDataPermissions);
dataPermissionRouter.post("/users/:userId/check", requireAuthWithTenant, ctrl.checkDataPermission);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/data-permissions",
  router: dataPermissionRouter,
  auth: "requireAuthWithTenant",
};
