import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as inventoryCostService from "../../services/admin/inventory-cost.service";

export const getInventoryCostDetail = asyncHandler(async (req, res) => {
  const result = await inventoryCostService.getInventoryCostDetail(
    req.tenantId!,
    req.query.startDate as string | undefined,
    req.query.endDate as string | undefined
  );
  res.json(ok(result));
});

export const getInventoryCostTrend = asyncHandler(async (req, res) => {
  const result = await inventoryCostService.getInventoryCostTrend(
    req.tenantId!,
    req.query.skuId ? Number(req.query.skuId) : undefined
  );
  res.json(ok(result));
});