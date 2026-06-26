import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as service from "../../services/admin/customer-payment.service.js";

export const list = asyncHandler(async (req, res) => {
  const result = await service.list({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!,
    customerId: req.query.customer_id ? Number(req.query.customer_id) : undefined,
    status: req.query.status as string | undefined,
    dateStart: req.query.start_date as string | undefined,
    dateEnd: req.query.end_date as string | undefined,
  });
  res.json(ok(result));
});

export const getDetail = asyncHandler(async (req, res) => {
  try {
    const result = await service.getDetail(req.params.receiptNo, req.tenantId!);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 404).json({ code: String(e.statusCode || 404), message: e.message });
  }
});

export const create = asyncHandler(async (req, res) => {
  const result = await service.create(req.body, req.tenantId!, req.user!.id, req.user!.username);
  res.json(ok(result));
});

export const voidPayment = asyncHandler(async (req, res) => {
  try {
    const result = await service.voidPayment(req.params.receiptNo, req.tenantId!, req.user!.id, req.user!.username);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});