import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as priceLevelService from "../../services/admin/price-level.service.js";

export const listPriceLevels = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await priceLevelService.listPriceLevels(tenantId);
  res.json(ok(result));
});

export const createPriceLevel = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    levelCode: z.string().min(1).max(32),
    levelName: z.string().min(1).max(64),
    discountRate: z.number().min(0).max(1.9999).default(1.0),
    minOrderAmount: z.number().min(0).default(0),
    description: z.string().max(255).default(""),
    sortOrder: z.number().int().default(0)
  }).parse(req.body);

  const result = await priceLevelService.createPriceLevel(body, tenantId);
  if (result.error) {
    res.status(Number(result.error.code)).json({ code: result.error.code, message: result.error.message });
    return;
  }
  res.json(ok(result.data));
});

export const updatePriceLevel = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const levelId = Number(req.params.id);
  const body = z.object({
    levelName: z.string().min(1).max(64).optional(),
    discountRate: z.number().min(0).max(1.9999).optional(),
    minOrderAmount: z.number().min(0).optional(),
    description: z.string().max(255).optional(),
    sortOrder: z.number().int().optional(),
    status: z.number().int().min(0).max(1).optional()
  }).parse(req.body);

  const result = await priceLevelService.updatePriceLevel(levelId, body, tenantId);
  if (result.error) {
    res.status(Number(result.error.code)).json({ code: result.error.code, message: result.error.message });
    return;
  }
  res.json(ok(result.data));
});

export const disablePriceLevel = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const levelId = Number(req.params.id);
  const result = await priceLevelService.disablePriceLevel(levelId, tenantId);
  if (result.error) {
    res.status(Number(result.error.code)).json({ code: result.error.code, message: result.error.message });
    return;
  }
  res.json(ok(result.data));
});
