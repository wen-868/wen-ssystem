import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

// S3-225（员工/账号域接线 · B2 批 7）：本文件 5 条写端点中**仅 1 条**接线：
//   · `PUT /staff/:id/status` ⇒ `system:user:edit`（079_权限矩阵.sql:271「编辑用户」，既有码，不新立码）。
//   零回归依据：真实调用点只有 admin-web 后台页 `router/index.ts:232 employees`[SUPER_ADMIN]（EmployeesView.vue:340）
//   与 `:233 organization`[SUPER_ADMIN]（OrganizationView.vue:385）；该码持有角色 = SUPER_ADMIN / OPERATION_ADMIN
//   （`guard-rbac-wiring.mjs --holders system:user:edit`，与生产底稿 `docs/evidence/_shared/prod-roles-20261016.txt` 一致）。
// S3-233（B 类收编第一批 · 员工/账号域）：上述"其余 4 条"的 B 类前提（`profile.vue:50` 入口**无条件**）
//   已由 S3-230 的入口权限门修复（该行现为 `canEntry('staff-entry')`，门码 = `system:user:create` + `system:user:edit`）
//   ⇒ 本批按注册表门码收编：`POST /staff` ⇒ `system:user:create`；其余 3 条（改 / 停用 / 恢复）⇒ `system:user:edit`。
//   零回归：两码持有人 = SUPER_ADMIN / OPERATION_ADMIN（`--holders`，与生产底稿一致）；店长等角色**看不到该入口**。
import { requirePermission } from "../middleware/rbac-auth";

import * as employeeController from "../controllers/admin/employee.controller";

export const adminStaffRouter = Router();

// ============ 员工管理 ============
adminStaffRouter.get("/staff", employeeController.listStaff);
adminStaffRouter.post("/staff", requirePermission("system:user:create"), employeeController.createStaff);
adminStaffRouter.put("/staff/:id", requirePermission("system:user:edit"), employeeController.updateStaff);
adminStaffRouter.put("/staff/:id/status", requirePermission("system:user:edit"), employeeController.setStaffStatus);
adminStaffRouter.put("/staff/:id/disable", requirePermission("system:user:edit"), employeeController.disableStaff);
adminStaffRouter.post("/staff/:id/restore", requirePermission("system:user:edit"), employeeController.restoreStaff);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminStaffRouter,
  auth: "requireAuthWithTenant",
};
