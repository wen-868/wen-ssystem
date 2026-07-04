import { z } from "zod";
import * as service from "../../services/admin/report-permission.service.js";

const saveMatrixSchema = z.object({
  permissions: z.array(z.object({
    role_id: z.number().int().positive(),
    report_code: z.string().min(1),
    store_scope: z.string().default(""),
  })).min(1),
});

export async function getMatrix(_req: any, res: any) {
  const rows = await service.getMatrix();
  res.json({ code: "0", message: "ok", data: rows });
}

export async function saveMatrix(req: any, res: any) {
  const body = saveMatrixSchema.parse(req.body);
  const data = body.permissions;
  await service.saveMatrix(data);
  res.json({ code: "0", message: "ok" });
}