import { z } from "zod";
import { ok } from "../../shared/response";
import * as reconciliationService from "../../services/admin/platform-reconciliation.service";

/** 对账列表（分页+筛选） */
export async function listReconciliations(req: any, res: any) {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    reconciliationNo: z.string().optional(),
    platformName: z.string().optional(),
    status: z.coerce.number().optional(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
  }).parse(req.query);
  const result = await reconciliationService.listReconciliations(tenantId, params);
  res.json(ok(result));
}

/** 创建对账 */
export async function createReconciliation(req: any, res: any) {
  const tenantId = req.tenantId!;
  const data = z.object({
    reconciliationNo: z.string().min(1),
    platformNo: z.string().min(1),
    platformName: z.string().min(1),
    type: z.number().int().min(0),
    amount: z.number().min(0),
    status: z.number().int().min(0).default(0),
    recordedAt: z.string().optional(),
  }).parse(req.body);
  const result = await reconciliationService.createReconciliation(tenantId, data);
  res.json(ok(result));
}

/** 更新对账 */
export async function updateReconciliation(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const data = z.object({
    status: z.number().int().min(0).optional(),
    amount: z.number().min(0).optional(),
  }).parse(req.body);
  const result = await reconciliationService.updateReconciliation(tenantId, id, data);
  res.json(ok(result));
}

/** 对账详情 */
export async function getReconciliationDetail(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await reconciliationService.getDetail(tenantId, id);
  res.json(ok(result));
}
