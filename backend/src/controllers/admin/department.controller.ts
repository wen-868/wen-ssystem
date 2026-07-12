import { ok } from "../../shared/response";
import * as departmentService from "../../services/admin/department.service";

export async function getDepartments(req: any, res: any) {
  const data = await departmentService.getDepartments((req as { tenantId?: number }).tenantId as any, req.query);
  res.json(ok(data));
}

export async function getDepartmentTree(req: any, res: any) {
  const data = await departmentService.getDepartmentTree((req as { tenantId?: number }).tenantId as any);
  res.json(ok(data));
}

export async function createDepartment(req: any, res: any) {
  const data = await departmentService.createDepartment(req.body);
  res.json(ok(data));
}

export async function updateDepartment(req: any, res: any) {
  const data = await departmentService.updateDepartment(Number(req.params.id), req.body);
  res.json(ok(data));
}

export async function deleteDepartment(req: any, res: any) {
  const data = await departmentService.deleteDepartment(Number(req.params.id));
  res.json(ok(data));
}

export async function moveDepartment(req: any, res: any) {
  const data = await departmentService.updateDepartment(Number(req.params.id), req.body);
  res.json(ok(data));
}
