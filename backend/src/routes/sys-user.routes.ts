import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";

// S3-225（员工/账号域接线 · B2 批 7）：本文件 4 条写端点中接线 3 条，全部挂 079 既有码（不新立码）：
//   · `POST /`（新增系统用户）⇒ `system:user:create`（079:270）；全仓无前端调用点（api 层零封装）⇒ 零回归。
//   · `POST /:id/reset-password`（重置他人口令）⇒ `system:user:edit`（079:271）。
//     ⚠️ 与台账 §三.1 的**机器建议码** `system:user:create` 有一处差异：重置口令是「改已存在用户」而非「新增」，
//     故按语义挂 `system:user:edit`；两者持有角色集合完全相同（SUPER_ADMIN / OPERATION_ADMIN）⇒ 零回归论证不受影响（见回执「待裁定项」）。
//     真实调用点：admin-web `EmployeesView.vue:363`、`OrganizationView.vue:405`（`router/index.ts:232/233`，均 [SUPER_ADMIN]）。
//   · `DELETE /:id`（删除系统用户）⇒ `system:user:edit`（079:271，台账建议码一致）；全仓无前端调用点 ⇒ 零回归。
// **未接 1 条**（自服务实际用途，报备待裁定）：`PUT /:id` —— 全仓唯一调用点是 app-mobile「我的 → 编辑资料」
//   `pages/profile/edit.vue:180`（`api/modules/profile.ts:26` `updateProfile`，传的是**本人** id）⇒ 该端点实际承担「本人资料保存」；
//   硬挂管理面码会把所有非 `*` 角色的「保存资料」打成 403（同 S3-203 `trace:*` 教训）⇒ 本批不接、逐条登记。
import { requirePermission } from "../middleware/rbac-auth";

import { listSysUsers, createSysUser, getSysUser, updateSysUser, resetSysUserPassword, deleteSysUser } from "../controllers/admin/sys-user.controller";

export const sysUserRouter = Router();

sysUserRouter.get("/", asyncHandler(listSysUsers));
sysUserRouter.post("/", requirePermission("system:user:create"), asyncHandler(createSysUser));
sysUserRouter.get("/:id", asyncHandler(getSysUser));
sysUserRouter.put("/:id", asyncHandler(updateSysUser));
sysUserRouter.post("/:id/reset-password", requirePermission("system:user:edit"), asyncHandler(resetSysUserPassword));
sysUserRouter.delete("/:id", requirePermission("system:user:edit"), asyncHandler(deleteSysUser));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/sys-users",
  router: sysUserRouter,
  auth: "requireAuthWithTenant",
};
