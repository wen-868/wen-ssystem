import { asyncHandler } from "../middleware/async-handler.js";
import { ok } from "../shared/response.js";
import * as service from "../services/admin/audit.service.js";
import { z } from "zod";

export const listAuditLogs = asyncHandler(async (req, res) => {
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    userId: z.coerce.number().optional(),
    action: z.string().optional(),
    resourceType: z.string().optional(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional()
  }).parse(req.query);

  const result = await service.listAuditLogs({
    ...params,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const getAuditStatistics = asyncHandler(async (req, res) => {
  const result = await service.getAuditStatistics(req.tenantId!);
  res.json(ok(result));
});