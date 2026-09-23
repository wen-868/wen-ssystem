import { z } from "zod";
import { ok } from "../../shared/response";
import * as auditLogService from "../../services/admin/platform-audit-log.service";

export async function listAuditLogs(req: any, res: any) {
  // R101-C4-1b 段二（包C）A8 修复随附：新增 action / adminName 两个**真实列**过滤参数的透传
  // （type/keyword 的过滤在服务层改为基于 detail JSON 派生，见 platform-audit-log.service.ts）
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    type: z.string().optional(),
    adminId: z.coerce.number().optional(),
    adminName: z.string().min(1).optional(),
    module: z.string().optional(),
    action: z.string().min(1).optional(),
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
