import { ok } from "../../shared/response";
import * as service from "../../services/admin/unit-group.service";

export async function listUnitGroups(req: any, res: any) {
  const data = await service.listGroups(req.tenantId, {
    keyword: req.query.keyword as string | undefined,
    status: req.query.status as string | undefined,
  });
  res.json(ok(data));
}

export async function getUnitGroup(req: any, res: any) {
  const data = await service.getGroup(Number(req.params.id), req.tenantId);
  res.json(ok(data));
}

export async function createUnitGroup(req: any, res: any) {
  const data = await service.createGroup(req.body, req.tenantId);
  res.json(ok(data));
}

export async function updateUnitGroup(req: any, res: any) {
  const data = await service.updateGroup(Number(req.params.id), req.body, req.tenantId);
  res.json(ok(data));
}

export async function deleteUnitGroup(req: any, res: any) {
  const data = await service.deleteGroup(Number(req.params.id), req.tenantId);
  res.json(ok(data));
}
