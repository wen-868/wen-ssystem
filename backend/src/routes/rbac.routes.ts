import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

// S3-225（员工/账号域接线 · B2 批 7）：本文件 5 条写端点中接线 2 条，均挂 079 既有码 `system:role:edit`（079:273）：
//   · `PUT /:id/data-permissions`（改角色数据权限）——真实调用点 admin-web `views/system/SystemRoles.vue:596/608`
//     （页 `router/index.ts:237 system/roles`[SUPER_ADMIN]）；无 app-mobile 调用点（移动端 role-edit.vue 只打 `PUT /:id`）。
//   · `PUT /users/:userId/roles`（改用户角色）——真实调用点 `views/system/SystemRoles.vue:650`（同页 [SUPER_ADMIN]）；
//     移动端 `api/modules/roles.ts:86 setUserRoles` 是**零引用导出**。
//   持有角色 = SUPER_ADMIN / OPERATION_ADMIN（`--holders system:role:edit`）⇒ 页面角色集 {SUPER_ADMIN} 全覆盖 ⇒ 零回归。
// **未接 3 条**（B 类，逐条登记）：`POST /`、`PUT /:id`、`DELETE /:id` —— app-mobile 角色管理页
//   `/pages-sub/admin/roles/roles`（`roles.vue:116`）与 `role-edit`（`role-edit.vue:225/227`）在「我的」页
//   `pages/profile/profile.vue:54` 是**无条件硬编码入口**（无角色门）⇒ 写调用点使用者集合不可枚举，
//   硬挂 `system:role:*` 会把店长等角色打成 403 ⇒ 待移动端补权限门后收编。
import * as ctrl from "../controllers/admin/rbac.controller";
export { requirePermission, checkUserPermission } from "../middleware/rbac-auth";

export const rbacRouter = Router();

rbacRouter.get("/", ctrl.listRoles);
rbacRouter.post("/", ctrl.createRole);
rbacRouter.get("/:id", ctrl.getRoleDetail);
rbacRouter.put("/:id", ctrl.updateRole);
rbacRouter.delete("/:id", ctrl.deleteRole);
rbacRouter.put("/:id/data-permissions", requirePermission("system:role:edit"), ctrl.updateRolePermissions);

rbacRouter.get("/users/:userId/roles", ctrl.getUserRoles);
rbacRouter.put("/users/:userId/roles", requirePermission("system:role:edit"), ctrl.setUserRoles);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/system/roles",
  router: rbacRouter,
  auth: "requireAuthWithTenant",
};
