import { Router, type Request, type Response } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as departmentService from "../services/admin/department.service.js";

export const departmentRouter = Router();

departmentRouter.get("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await departmentService.getDepartments((req as any).tenantId, req.query); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
departmentRouter.get("/tree", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await departmentService.getDepartmentTree((req as any).tenantId); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
departmentRouter.post("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await departmentService.createDepartment(req.body); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
departmentRouter.put("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await departmentService.updateDepartment(Number(req.params.id), req.body); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
departmentRouter.delete("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await departmentService.deleteDepartment(Number(req.params.id)); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
departmentRouter.put("/:id/move", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await departmentService.updateDepartment(Number(req.params.id), req.body); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});