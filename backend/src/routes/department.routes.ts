import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import { getDepartments, getDepartmentTree, createDepartment, updateDepartment, deleteDepartment, moveDepartment } from "../controllers/admin/department.controller";

export const departmentRouter = Router();

departmentRouter.get("/", requireAuthWithTenant, asyncHandler(getDepartments));
departmentRouter.get("/tree", requireAuthWithTenant, asyncHandler(getDepartmentTree));
departmentRouter.post("/", requireAuthWithTenant, asyncHandler(createDepartment));
departmentRouter.put("/:id", requireAuthWithTenant, asyncHandler(updateDepartment));
departmentRouter.delete("/:id", requireAuthWithTenant, asyncHandler(deleteDepartment));
departmentRouter.put("/:id/move", requireAuthWithTenant, asyncHandler(moveDepartment));

export const routeConfig: RouteConfig = {
  prefix: "/api/department",
  router: departmentRouter,
  auth: "requireAuthWithTenant",
};
