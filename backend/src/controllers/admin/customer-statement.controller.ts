import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as service from "../../services/admin/customer-statement.service.js";

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
  const result = await service.getDetail(req.params.statementNo, req.tenantId!);
  res.json(ok(result));
});

export const create = asyncHandler(async (req, res) => {
  const result = await service.create(req.body, req.tenantId!, req.user!.id, req.user!.username);
  res.json(ok(result));
});

export const confirm = asyncHandler(async (req, res) => {
  const result = await service.confirm(req.params.statementNo, req.tenantId!, req.user!.id, req.user!.username);
  res.json(ok(result));
});

export const markPaid = asyncHandler(async (req, res) => {
  const result = await service.markPaid(req.params.statementNo, req.tenantId!, req.user!.id, req.user!.username);
  res.json(ok(result));
});