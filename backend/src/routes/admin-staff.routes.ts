import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

// S3-225（员工/账号域接线 · B2 批 7）：本文件 5 条写端点中**仅 1 条**接线：
//   · `PUT /staff/:id/status` ⇒ `system:user:edit`（079_权限矩阵.sql:271「编辑用户」，既有码，不新立码）。
//   零回归依据：真实调用点只有 admin-web 后台页 `router/index.ts:232 employees`[SUPER_ADMIN]（EmployeesView.vue:340）
//   与 `:233 organization`[SUPER_ADMIN]（OrganizationView.vue:385）；该码持有角色 = SUPER_ADMIN / OPERATION_ADMIN
//   （`guard-rbac-wiring.mjs --holders system:user:edit`，与生产底稿 `docs/evidence/_shared/prod-roles-20261016.txt` 一致）。
// 其余 4 条（POST /staff、PUT /staff/:id、PUT /staff/:id/disable、POST /staff/:id/restore）**本批不接**（B 类）：
//   app-mobile「我的」页 `pages/profile/profile.vue:50` 对员工管理页 `/pages-sub/admin/admin/employees` 是**无条件硬编码入口**
//   （无角色门、无 code 判定），该页写调用点（`employees.vue:132/159/179/187`）的**使用者集合不可枚举**
//   ⇒ 硬挂 `system:user:*` 会把店长等角色打成 403（同批 1 `trace:*` / 批 5 B 类形态）⇒ 逐条登记待移动端补权限门后收编。
import { requirePermission } from "../middleware/rbac-auth";

import * as employeeController from "../controllers/admin/employee.controller";

export const adminStaffRouter = Router();

// ============ 员工管理 ============
adminStaffRouter.get("/staff", employeeController.listStaff);
adminStaffRouter.post("/staff", employeeController.createStaff);
adminStaffRouter.put("/staff/:id", employeeController.updateStaff);
adminStaffRouter.put("/staff/:id/status", requirePermission("system:user:edit"), employeeController.setStaffStatus);
adminStaffRouter.put("/staff/:id/disable", employeeController.disableStaff);
adminStaffRouter.post("/staff/:id/restore", employeeController.restoreStaff);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminStaffRouter,
  auth: "requireAuthWithTenant",
};
