import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as svcService from "../../services/admin/store-value-card.service.js";

export const listStoreValueCards = asyncHandler(async (req, res) => {
  res.json(ok(await svcService.listStoreValueCards({
    customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
    status: req.query.status as string | undefined,
    page: Number(req.query.page || 1), pageSize: Number(req.query.pageSize || 20), tenantId: req.tenantId!
  })));
});
export const createStoreValueCard = asyncHandler(async (req, res) => {
  const { customerId, customerName, initialAmount } = req.body;
  res.json(ok(await svcService.createStoreValueCard({ customerId, customerName, initialAmount, tenantId: req.tenantId! })));
});
export const getStoreValueCard = asyncHandler(async (req, res) => { res.json(ok(await svcService.getStoreValueCard(req.params.cardNo, req.tenantId!))); });
export const rechargeCard = asyncHandler(async (req, res) => {
  const { amount, payMethod } = req.body;
  res.json(ok(await svcService.rechargeCard({ cardNo: req.params.cardNo, amount, payMethod, operatorId: req.user!.id, tenantId: req.tenantId! })));
});
export const consumeCard = asyncHandler(async (req, res) => {
  const { amount, sourceNo, remark } = req.body;
  res.json(ok(await svcService.consumeCard({ cardNo: req.params.cardNo, amount, sourceNo, remark, operatorId: req.user!.id, tenantId: req.tenantId! })));
});
export const refundCard = asyncHandler(async (req, res) => {
  const { amount, remark } = req.body;
  res.json(ok(await svcService.refundCard({ cardNo: req.params.cardNo, amount, remark, operatorId: req.user!.id, tenantId: req.tenantId! })));
});
export const freezeCard = asyncHandler(async (req, res) => { res.json(ok(await svcService.freezeCard(req.params.cardNo, req.tenantId!))); });
export const unfreezeCard = asyncHandler(async (req, res) => { res.json(ok(await svcService.unfreezeCard(req.params.cardNo, req.tenantId!))); });
export const listStoreValueTransactions = asyncHandler(async (req, res) => {
  res.json(ok(await svcService.listStoreValueTransactions({
    cardNo: req.params.cardNo, page: Number(req.query.page || 1), pageSize: Number(req.query.pageSize || 20), tenantId: req.tenantId!
  })));
});