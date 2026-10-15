import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

// S3-225（员工/账号域接线 · B2 批 7）：本文件 6 条写端点中接线 5 条，全部挂 079 既有码（不新立码）：
//   新增类（`system:role:create`，079:272）：`POST /`、`POST /roles/:roleId`；
//   编辑/删除类（`system:role:edit`，079:273）：`PUT /:id`、`DELETE /:id`、`DELETE /roles/:roleId/:dataPermissionId`。
//   零回归依据（本批最干净的一组）：**全仓 0 个前端调用点**（`docs/evidence/S3-225/02-callers.txt` 逐条为「全仓无调用点」，
//   前端数据权限功能走的是 `rbac.routes.ts` 的 `PUT /api/admin/system/roles/:id/data-permissions`，不经过本文件）；
//   持有角色 = SUPER_ADMIN / OPERATION_ADMIN ⇒ 无「页面使用者被误拦」的可能。
// **未接 1 条**：`POST /users/:userId/check` —— **查询型 POST**（只读判定「某用户是否有某数据权限」），
//   按派单卡 §二.4 口径**不按写端点接线**，保留在机读台账 `gaps` 里（逐条登记）。
import { requirePermission } from "../middleware/rbac-auth";

import * as ctrl from "../controllers/admin/data-permission.controller";

export const dataPermissionRouter = Router();

dataPermissionRouter.get("/", ctrl.listDataPermissions);
dataPermissionRouter.post("/", requirePermission("system:role:create"), ctrl.createDataPermission);
dataPermissionRouter.get("/:id", ctrl.getDataPermissionDetail);
dataPermissionRouter.put("/:id", requirePermission("system:role:edit"), ctrl.updateDataPermission);
dataPermissionRouter.delete("/:id", requirePermission("system:role:edit"), ctrl.deleteDataPermission);

dataPermissionRouter.get("/roles/:roleId", ctrl.getRoleDataPermissions);
dataPermissionRouter.post("/roles/:roleId", requirePermission("system:role:create"), ctrl.assignRoleDataPermission);
dataPermissionRouter.delete("/roles/:roleId/:dataPermissionId", requirePermission("system:role:edit"), ctrl.removeRoleDataPermission);

dataPermissionRouter.get("/users/:userId", ctrl.getUserDataPermissions);
dataPermissionRouter.post("/users/:userId/check", ctrl.checkDataPermission);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/data-permissions",
  router: dataPermissionRouter,
  auth: "requireAuthWithTenant",
};
