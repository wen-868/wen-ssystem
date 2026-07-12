import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/admin/unit.service";

export async function listUnits(req: any, res: any) {
  const rows = await service.list({
    keyword: req.query.keyword as string | undefined,
    tenantId: req.tenantId!,
  });
  res.json(ok(rows));
}

export async function createUnit(req: any, res: any) {
  const body = z.object({
    name: z.string().min(1).max(32),
    code: z.string().min(1).max(32),
    type: z.enum(["BASE", "BOX"]).default("BASE"),
    sortNo: z.number().int().default(0),
  }).parse(req.body);
  const result = await service.create(body, req.tenantId!);
  res.json(ok(result));
}

export async function updateUnit(req: any, res: any) {
  const body = z.object({
    name: z.string().min(1).max(32).optional(),
    code: z.string().min(1).max(32).optional(),
    type: z.enum(["BASE", "BOX"]).optional(),
    sortNo: z.number().int().optional(),
  }).parse(req.body);
  const result = await service.update(Number(req.params.id), body, req.tenantId!);
  res.json(ok(result));
}

export async function deleteUnit(req: any, res: any) {
  const result = await service.remove(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
}
