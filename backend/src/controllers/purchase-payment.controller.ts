import { asyncHandler } from "../middleware/async-handler.js";
import { ok } from "../shared/response.js";
import * as service from "../services/admin/purchase-payment.service.js";

export const list = asyncHandler(async (req, res) => {
  const result = await service.list({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!,
    supplierId: req.query.supplier_id ? Number(req.query.supplier_id) : undefined,
    paymentType: req.query.payment_type as string | undefined,
    status: req.query.status as string | undefined,
    dateStart: req.query.start_date as string | undefined,
    dateEnd: req.query.end_date as string | undefined,
  });
  res.json(ok(result));
});

export const getDetail = asyncHandler(async (req, res) => {
  const result = await service.getDetail(req.params.paymentNo, req.tenantId!);
  res.json(ok(result));
});

export const create = asyncHandler(async (req, res) => {
  const result = await service.create(req.body, req.tenantId!, req.user!.id, req.user!.username);
  res.json(ok(result));
});

export const approve = asyncHandler(async (req, res) => {
  const result = await service.approve(req.params.paymentNo, req.tenantId!, req.user!.id, req.user!.username);
  res.json(ok(result));
});

export const voidPayment = asyncHandler(async (req, res) => {
  const result = await service.voidPayment(req.params.paymentNo, req.tenantId!, req.user!.id, req.user!.username);
  res.json(ok(result));
});