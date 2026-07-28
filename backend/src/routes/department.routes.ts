import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import { getDepartments, getDepartmentTree, createDepartment, updateDepartment, deleteDepartment, moveDepartment } from "../controllers/admin/department.controller";

export const departmentRouter = Router();

departmentRouter.get("/", asyncHandler(getDepartments));
departmentRouter.get("/tree", asyncHandler(getDepartmentTree));
departmentRouter.post("/", asyncHandler(createDepartment));
departmentRouter.put("/:id", asyncHandler(updateDepartment));
departmentRouter.delete("/:id", asyncHandler(deleteDepartment));
departmentRouter.put("/:id/move", asyncHandler(moveDepartment));

export const routeConfig: RouteConfig = {
  prefix: "/api/department",
  router: departmentRouter,
  auth: "requireAuthWithTenant",
};
