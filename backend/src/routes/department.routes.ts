import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { ok } from "../shared/response.js";
import * as departmentService from "../services/admin/department.service.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const departmentRouter = Router();

departmentRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await departmentService.getDepartments((req as { tenantId?: number }).tenantId as any, req.query); res.json(ok(data));
}));
departmentRouter.get("/tree", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await departmentService.getDepartmentTree((req as { tenantId?: number }).tenantId as any); res.json(ok(data));
}));
departmentRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await departmentService.createDepartment(req.body); res.json(ok(data));
}));
departmentRouter.put("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await departmentService.updateDepartment(Number(req.params.id), req.body); res.json(ok(data));
}));
departmentRouter.delete("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await departmentService.deleteDepartment(Number(req.params.id)); res.json(ok(data));
}));
departmentRouter.put("/:id/move", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await departmentService.updateDepartment(Number(req.params.id), req.body); res.json(ok(data));
}));