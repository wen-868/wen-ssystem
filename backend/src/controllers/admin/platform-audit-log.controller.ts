import { z } from "zod";
import { ok } from "../../shared/response";
import * as auditLogService from "../../services/admin/platform-audit-log.service";

export async function listAuditLogs(req: any, res: any) {
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    type: z.string().optional(),
    adminId: z.coerce.number().optional(),
    module: z.string().optional(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
    keyword: z.string().optional(),
  }).parse(req.query);
  const result = await auditLogService.listAuditLogs(params);
  res.json(ok(result));
}

export async function getAuditLogById(req: any, res: any) {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await auditLogService.getAuditLogById(id);
  res.json(ok(result));
}
