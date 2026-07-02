import * as service from "../../services/admin/report-permission.service.js";

export async function getMatrix(_req: any, res: any) {
  const rows = await service.getMatrix();
  res.json({ code: "0", message: "ok", data: rows });
}

export async function saveMatrix(req: any, res: any) {
  const data = req.body as Array<{ role_id: number; report_code: string; store_scope: string }>;
  await service.saveMatrix(data);
  res.json({ code: "0", message: "ok" });
}