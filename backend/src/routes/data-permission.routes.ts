import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/admin/data-permission.controller";

export const dataPermissionRouter = Router();

dataPermissionRouter.get("/", ctrl.listDataPermissions);
dataPermissionRouter.post("/", ctrl.createDataPermission);
dataPermissionRouter.get("/:id", ctrl.getDataPermissionDetail);
dataPermissionRouter.put("/:id", ctrl.updateDataPermission);
dataPermissionRouter.delete("/:id", ctrl.deleteDataPermission);

dataPermissionRouter.get("/roles/:roleId", ctrl.getRoleDataPermissions);
dataPermissionRouter.post("/roles/:roleId", ctrl.assignRoleDataPermission);
dataPermissionRouter.delete("/roles/:roleId/:dataPermissionId", ctrl.removeRoleDataPermission);

dataPermissionRouter.get("/users/:userId", ctrl.getUserDataPermissions);
dataPermissionRouter.post("/users/:userId/check", ctrl.checkDataPermission);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/data-permissions",
  router: dataPermissionRouter,
  auth: "requireAuthWithTenant",
};
