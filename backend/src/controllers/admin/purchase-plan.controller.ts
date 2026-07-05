import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as purchasePlanService from "../../services/admin/purchase-plan.service.js";

export const suggestPurchasePlan = asyncHandler(async (req, res) => {
  const result = await purchasePlanService.suggestPurchasePlan(
    req.tenantId!,
    req.query.storeId ? Number(req.query.storeId) : undefined
  );
  res.json(ok(result));
});

export const createPurchasePlan = asyncHandler(async (req, res) => {
  const { supplierId, storeId, items } = req.body;
  const result = await purchasePlanService.createPurchasePlan({
    supplierId, storeId, items, tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const listPurchasePlans = asyncHandler(async (req, res) => {
  const result = await purchasePlanService.listPurchasePlans({
    supplierId: req.query.supplierId ? Number(req.query.supplierId) : undefined,
    status: req.query.status as string | undefined,
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const convertPurchasePlan = asyncHandler(async (req, res) => {
  const result = await purchasePlanService.convertPurchasePlan(req.params.planNo, req.tenantId!);
  res.json(ok(result));
});