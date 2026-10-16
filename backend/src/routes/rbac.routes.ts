import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

// S3-225（员工/账号域接线 · B2 批 7）：本文件 5 条写端点中接线 2 条，均挂 079 既有码 `system:role:edit`（079:273）：
//   · `PUT /:id/data-permissions`（改角色数据权限）——真实调用点 admin-web `views/system/SystemRoles.vue:596/608`
//     （页 `router/index.ts:237 system/roles`[SUPER_ADMIN]）；无 app-mobile 调用点（移动端 role-edit.vue 只打 `PUT /:id`）。
//   · `PUT /users/:userId/roles`（改用户角色）——真实调用点 `views/system/SystemRoles.vue:650`（同页 [SUPER_ADMIN]）；
//     移动端 `api/modules/roles.ts:86 setUserRoles` 是**零引用导出**。
//   持有角色 = SUPER_ADMIN / OPERATION_ADMIN（`--holders system:role:edit`）⇒ 页面角色集 {SUPER_ADMIN} 全覆盖 ⇒ 零回归。
// S3-233（B 类收编第一批 · 员工/账号域）：上述"未接 3 条"（`POST /`、`PUT /:id`、`DELETE /:id`）的 B 类前提
//   （`profile.vue:54` 角色管理入口**无条件**）已由 S3-230 的入口权限门修复（现为 `canEntry('role-entry')`，
//   门码 = `system:role:create` + `system:role:edit`）⇒ 本批按注册表门码收编：新建立码 / 改删取 `edit`。
//   持有人 = SUPER_ADMIN / OPERATION_ADMIN（同 :10 复算）；店长等角色**看不到该入口**。
import * as ctrl from "../controllers/admin/rbac.controller";
export { requirePermission, checkUserPermission } from "../middleware/rbac-auth";

export const rbacRouter = Router();

rbacRouter.get("/", ctrl.listRoles);
rbacRouter.post("/", requirePermission("system:role:create"), ctrl.createRole);
rbacRouter.get("/:id", ctrl.getRoleDetail);
rbacRouter.put("/:id", requirePermission("system:role:edit"), ctrl.updateRole);
rbacRouter.delete("/:id", requirePermission("system:role:edit"), ctrl.deleteRole);
rbacRouter.put("/:id/data-permissions", requirePermission("system:role:edit"), ctrl.updateRolePermissions);

rbacRouter.get("/users/:userId/roles", ctrl.getUserRoles);
rbacRouter.put("/users/:userId/roles", requirePermission("system:role:edit"), ctrl.setUserRoles);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/system/roles",
  router: rbacRouter,
  auth: "requireAuthWithTenant",
};
