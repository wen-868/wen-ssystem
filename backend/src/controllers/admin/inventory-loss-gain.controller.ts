import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as inventoryLossGainService from "../../services/admin/inventory-loss-gain.service";

export const reportLossGain = asyncHandler(async (req, res) => {
  const { storeId, type, skuId, qty, costPrice, reason } = req.body;
  const result = await inventoryLossGainService.reportLossGain({
    storeId, type, skuId, qty, costPrice, reason,
    operatorId: req.user!.id,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const listLossGains = asyncHandler(async (req, res) => {
  const result = await inventoryLossGainService.listLossGains({
    storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
    type: req.query.type as string | undefined,
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});