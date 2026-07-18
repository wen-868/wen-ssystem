import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as employeeController from "../controllers/admin/employee.controller";

export const adminStaffRouter = Router();

// ============ 员工管理 ============
adminStaffRouter.get("/staff", requireAuthWithTenant, employeeController.listStaff);
adminStaffRouter.post("/staff", requireAuthWithTenant, employeeController.createStaff);
adminStaffRouter.put("/staff/:id", requireAuthWithTenant, employeeController.updateStaff);
adminStaffRouter.put("/staff/:id/disable", requireAuthWithTenant, employeeController.disableStaff);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminStaffRouter,
  auth: "requireAuthWithTenant",
};