import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as receiptService from "../../services/admin/receipt.service.js";

export const createReceipt = asyncHandler(async (req, res) => {
  const { customerId, customerName, receiptType, amount, paymentMethod, bankAccountId, receivedDate, remark } = req.body;
  res.json(ok(await receiptService.createReceipt({ customerId, customerName, receiptType, amount, paymentMethod, bankAccountId, receivedDate, remark, operatorId: req.user!.id, tenantId: req.tenantId! })));
});
export const listReceipts = asyncHandler(async (req, res) => {
  res.json(ok(await receiptService.listReceipts({ customerId: req.query.customerId ? Number(req.query.customerId) : undefined, status: req.query.status as string | undefined, page: Number(req.query.page || 1), pageSize: Number(req.query.pageSize || 20), tenantId: req.tenantId! })));
});
export const getReceiptDetail = asyncHandler(async (req, res) => { res.json(ok(await receiptService.getReceiptDetail(req.params.receiptNo, req.tenantId!))); });
export const writeoffReceipt = asyncHandler(async (req, res) => {
  const { receivableId, writeoffAmount } = req.body;
  res.json(ok(await receiptService.writeoffReceipt(req.params.receiptNo, receivableId, writeoffAmount, req.tenantId!)));
});
export const voidReceipt = asyncHandler(async (req, res) => { res.json(ok(await receiptService.voidReceipt(req.params.receiptNo, req.tenantId!))); });