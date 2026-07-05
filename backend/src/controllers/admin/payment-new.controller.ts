import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as paymentNewService from "../../services/admin/payment-new.service.js";

export const createPayment = asyncHandler(async (req, res) => {
  const { supplierId, supplierName, paymentType, amount, paymentMethod, bankAccountId, paidDate, remark } = req.body;
  res.json(ok(await paymentNewService.createPayment({ supplierId, supplierName, paymentType, amount, paymentMethod, bankAccountId, paidDate, remark, operatorId: req.user!.id, tenantId: req.tenantId! })));
});
export const listPayments = asyncHandler(async (req, res) => {
  res.json(ok(await paymentNewService.listPayments({ supplierId: req.query.supplierId ? Number(req.query.supplierId) : undefined, paymentType: req.query.paymentType as string | undefined, status: req.query.status as string | undefined, page: Number(req.query.page || 1), pageSize: Number(req.query.pageSize || 20), tenantId: req.tenantId! })));
});
export const getPaymentDetail = asyncHandler(async (req, res) => { res.json(ok(await paymentNewService.getPaymentDetail(req.params.paymentNo, req.tenantId!))); });
export const writeoffPayment = asyncHandler(async (req, res) => {
  const { payableId, writeoffAmount } = req.body;
  res.json(ok(await paymentNewService.writeoffPayment(req.params.paymentNo, payableId, writeoffAmount, req.tenantId!)));
});
export const voidPayment = asyncHandler(async (req, res) => { res.json(ok(await paymentNewService.voidPayment(req.params.paymentNo, req.tenantId!))); });