import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { ok, fail } from "../shared/response.js";
import * as departmentService from "../services/admin/department.service.js";

export const departmentRouter = Router();

departmentRouter.get("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await departmentService.getDepartments((req as { tenantId?: number }).tenantId as any, req.query); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
departmentRouter.get("/tree", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await departmentService.getDepartmentTree((req as { tenantId?: number }).tenantId as any); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
departmentRouter.post("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await departmentService.createDepartment(req.body); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
departmentRouter.put("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await departmentService.updateDepartment(Number(req.params.id), req.body); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
departmentRouter.delete("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await departmentService.deleteDepartment(Number(req.params.id)); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
departmentRouter.put("/:id/move", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await departmentService.updateDepartment(Number(req.params.id), req.body); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
