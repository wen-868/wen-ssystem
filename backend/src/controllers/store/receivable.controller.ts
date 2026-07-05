import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as svc from "../../services/store/receivable.service.js";

export const listReceivables = asyncHandler(async (req, res) => {
  const result = await svc.listReceivables({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    storeId: req.user?.storeId ?? null,
    status: req.query.status ? String(req.query.status) : null,
    keyword: String(req.query.keyword || ""),
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const paymentOnReceivable = asyncHandler(async (req, res) => {
  const body = z.object({
    amount: z.number().positive(),
    paymentMethod: z.enum(["CASH", "TRANSFER", "OTHER_WECHAT", "ALIPAY"]),
    remark: z.string().optional()
  }).parse(req.body);
  const result = await svc.paymentOnReceivable({
    receivableNo: req.params.receivableNo,
    amount: body.amount,
    paymentMethod: body.paymentMethod,
    remark: body.remark,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const getDashboard = asyncHandler(async (req, res) => {
  const result = await svc.getDashboard({
    storeId: req.query.storeId ? Number(req.query.storeId) : req.user?.storeId ?? null,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const getDailySales = asyncHandler(async (req, res) => {
  const result = await svc.getDailySales(
    req.query.storeId ? Number(req.query.storeId) : req.user?.storeId ?? null,
    req.tenantId!
  );
  res.json(ok(result));
});