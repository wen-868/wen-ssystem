import { z } from "zod";
import { ok, fail } from "../../shared/response";
import * as operationLogService from "../../services/admin/operation-log.service";

export async function listOperationLogs(req: any, res: any) {
  const tenantId = req.tenantId!;
  const schema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    module: z.string().optional(),
    action: z.string().optional(),
    operatorName: z.string().optional(),
    bizNo: z.string().optional(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
  });
  const params = schema.parse(req.query);
  const result = await operationLogService.listLogs(tenantId, params);
  res.json(ok(result));
}

export async function getOperationLogStatistics(req: any, res: any) {
  const tenantId = req.tenantId!;
  const result = await operationLogService.getStatistics(tenantId);
  res.json(ok(result));
}

export async function getOperationLogDetail(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json(fail("日志ID无效", "400"));
    return;
  }

  const detail = await operationLogService.getLogById(tenantId, id);
  if (!detail) {
    res.status(404).json(fail("操作日志不存在", "404"));
    return;
  }
  res.json(ok(detail));
}

export async function getOperationLogTypes(_req: any, res: any) {
  res.json(ok(operationLogService.getLogTypes()));
}
