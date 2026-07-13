import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { z } from "zod";
import * as stockWarningService from "../../services/admin/stock-warning.service";

export const getStockWarnings = asyncHandler(async (req, res) => {
  const result = await stockWarningService.getStockWarnings(
    req.tenantId!,
    req.query.storeId ? Number(req.query.storeId) : undefined
  );
  res.json(ok(result));
});

export const batchConfigStockWarning = asyncHandler(async (req, res) => {
  const { storeId, configs } = req.body;
  const result = await stockWarningService.batchConfigStockWarning({
    storeId, configs, tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const getStockWarningConfigs = asyncHandler(async (req, res) => {
  const result = await stockWarningService.getStockWarningConfigs(
    req.tenantId!,
    req.query.storeId ? Number(req.query.storeId) : undefined
  );
  res.json(ok(result));
});

export const updateWarningThreshold = asyncHandler(async (req, res) => {
  const skuId = z.coerce.number().parse(req.params.id);
  const body = z.object({
    storeId: z.number().int().positive(),
    minQty: z.number().int().min(0),
    maxQty: z.number().int().min(0)
  }).parse(req.body);
  const result = await stockWarningService.updateWarningThreshold({
    skuId, ...body, tenantId: req.tenantId!
  });
  res.json(ok(result));
});