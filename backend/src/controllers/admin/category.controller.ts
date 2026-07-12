import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/admin/category.service";

export async function listCategories(req: any, res: any) {
  const pid = req.query.pid !== undefined ? Number(req.query.pid) : undefined;
  const allowOnlineSale = req.query.allow_online_sale !== undefined ? Number(req.query.allow_online_sale) : undefined;
  const rows = await service.list({ pid, allowOnlineSale, tenantId: req.tenantId! });
  res.json(ok(rows));
}

export async function createCategory(req: any, res: any) {
  const body = z.object({
    name: z.string().min(1).max(64),
    parentId: z.number().int().nullable().optional(),
    sortNo: z.number().int().default(0),
    icon: z.string().max(255).optional(),
    code: z.string().max(64).optional(),
    allowOnlineSale: z.number().int().min(0).max(1).optional(),
  }).parse(req.body);
  const result = await service.create(body, req.tenantId!);
  res.json(ok(result));
}

export async function updateCategory(req: any, res: any) {
  const body = z.object({
    name: z.string().min(1).max(64).optional(),
    parentId: z.number().int().nullable().optional(),
    sortNo: z.number().int().optional(),
    icon: z.string().max(255).optional(),
    code: z.string().max(64).optional(),
    allowOnlineSale: z.number().int().min(0).max(1).optional(),
  }).parse(req.body);
  const result = await service.update(Number(req.params.id), body, req.tenantId!);
  res.json(ok(result));
}

export async function deleteCategory(req: any, res: any) {
  const result = await service.remove(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
}

export async function sortCategory(req: any, res: any) {
  const body = z.object({
    sortNo: z.number().int(),
  }).parse(req.body);
  const result = await service.sort(
    [{ id: Number(req.params.id), sortNo: body.sortNo }],
    req.tenantId!
  );
  res.json(ok(result));
}
