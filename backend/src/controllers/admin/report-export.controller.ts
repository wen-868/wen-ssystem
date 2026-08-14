import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as svc from "../../services/admin/report-export.service";

export const exportReport = asyncHandler(async (req: Request, res: Response) => {
  const { report_type, format, filters, columns } = req.body;
  const result = await svc.exportReport({ report_type, format: format ?? "excel", filters, columns }, req.tenantId!);
  res.json(ok(result));
});