import { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as svc from "../../services/admin/report-export.service.js";

export const exportReport = asyncHandler(async (req: Request, res: Response) => {
  const { report_type, format, filters, columns } = req.body;
  const result = await svc.exportReport({ report_type, format: format ?? "excel", filters, columns }, req.tenantId!);
  res.json(ok(result));
});