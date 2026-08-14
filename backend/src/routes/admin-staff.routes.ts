import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as employeeController from "../controllers/admin/employee.controller";

export const adminStaffRouter = Router();

// ============ 员工管理 ============
adminStaffRouter.get("/staff", employeeController.listStaff);
adminStaffRouter.post("/staff", employeeController.createStaff);
adminStaffRouter.put("/staff/:id", employeeController.updateStaff);
adminStaffRouter.put("/staff/:id/status", employeeController.setStaffStatus);
adminStaffRouter.put("/staff/:id/disable", employeeController.disableStaff);
adminStaffRouter.post("/staff/:id/restore", employeeController.restoreStaff);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminStaffRouter,
  auth: "requireAuthWithTenant",
};
