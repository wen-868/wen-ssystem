import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/admin/brand.service";

export async function listBrands(req: any, res: any) {
  const rows = await service.list({
    keyword: req.query.keyword as string | undefined,
    tenantId: req.tenantId!,
  });
  res.json(ok(rows));
}

export async function createBrand(req: any, res: any) {
  const body = z.object({
    name: z.string().min(1).max(64),
    logo: z.string().max(512).optional(),
    description: z.string().max(255).optional(),
    sortNo: z.number().int().default(0),
  }).parse(req.body);
  const result = await service.create(body, req.tenantId!);
  res.json(ok(result));
}

export async function updateBrand(req: any, res: any) {
  const body = z.object({
    name: z.string().min(1).max(64).optional(),
    logo: z.string().max(512).optional(),
    description: z.string().max(255).optional(),
    sortNo: z.number().int().optional(),
  }).parse(req.body);
  const result = await service.update(Number(req.params.id), body, req.tenantId!);
  res.json(ok(result));
}

export async function deleteBrand(req: any, res: any) {
  const result = await service.remove(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
}
