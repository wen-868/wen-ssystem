import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as receivableService from "../../services/admin/receivable.service.js";

export const listReceivables = asyncHandler(async (req, res) => {
  res.json(ok(await receivableService.listReceivables({ customerId: req.query.customerId ? Number(req.query.customerId) : undefined, status: req.query.status as string | undefined, page: Number(req.query.page || 1), pageSize: Number(req.query.pageSize || 20), tenantId: req.tenantId! })));
});
export const listPayables = asyncHandler(async (req, res) => {
  res.json(ok(await receivableService.listPayables({ supplierId: req.query.supplierId ? Number(req.query.supplierId) : undefined, status: req.query.status as string | undefined, page: Number(req.query.page || 1), pageSize: Number(req.query.pageSize || 20), tenantId: req.tenantId! })));
});
export const getReceivablesAging = asyncHandler(async (req, res) => { res.json(ok(await receivableService.getReceivablesAging(req.tenantId!))); });
export const getPayablesAging = asyncHandler(async (req, res) => { res.json(ok(await receivableService.getPayablesAging(req.tenantId!))); });
export const getReceivableDetail = asyncHandler(async (req, res) => { res.json(ok(await receivableService.getReceivableDetail(Number(req.params.id), req.tenantId!))); });
export const getPayableDetail = asyncHandler(async (req, res) => { res.json(ok(await receivableService.getPayableDetail(Number(req.params.id), req.tenantId!))); });