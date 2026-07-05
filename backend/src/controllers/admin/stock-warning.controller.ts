import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as stockWarningService from "../../services/admin/stock-warning.service.js";

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