import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as priceManagementService from "../../services/admin/price-management.service.js";

export const listSkuPrices = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const skuId = Number(req.params.skuId);
  const result = await priceManagementService.listSkuPrices(skuId, tenantId);
  res.json(ok(result));
});

export const setSkuPrices = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const skuId = Number(req.params.skuId);
  const body = z.object({
    prices: z.array(z.object({
      priceLevelId: z.number().int().positive(),
      minQty: z.number().int().min(1).default(1),
      price: z.number().min(0),
      costPrice: z.number().min(0).default(0),
      suggestedRetailPrice: z.number().min(0).default(0),
      effectiveStart: z.string().nullable().default(null),
      effectiveEnd: z.string().nullable().default(null)
    })).min(1)
  }).parse(req.body);

  const result = await priceManagementService.setSkuPrices(skuId, body.prices, req.user!.id, tenantId);
  if (result.error) {
    res.status(Number(result.error.code)).json({ code: result.error.code, message: result.error.message });
    return;
  }
  res.json(ok(result.data));
});

export const updateSkuPrice = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const priceId = Number(req.params.id);
  const body = z.object({
    minQty: z.number().int().min(1).optional(),
    price: z.number().min(0).optional(),
    costPrice: z.number().min(0).optional(),
    suggestedRetailPrice: z.number().min(0).optional(),
    effectiveStart: z.string().nullable().optional(),
    effectiveEnd: z.string().nullable().optional(),
    status: z.number().int().min(0).max(1).optional()
  }).parse(req.body);

  const result = await priceManagementService.updateSkuPrice(priceId, body, req.user!.id, tenantId);
  if (result.error) {
    res.status(Number(result.error.code)).json({ code: result.error.code, message: result.error.message });
    return;
  }
  res.json(ok(result.data));
});

export const deleteSkuPrice = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const priceId = Number(req.params.id);
  const result = await priceManagementService.deleteSkuPrice(priceId, tenantId);
  if (result.error) {
    res.status(Number(result.error.code)).json({ code: result.error.code, message: result.error.message });
    return;
  }
  res.json(ok(result.data));
});

export const getBestPrice = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    customerId: z.number().int().positive(),
    skuId: z.number().int().positive(),
    quantity: z.number().int().min(1)
  }).parse(req.body);

  const isAdmin = !!(req.user?.roles?.includes("SUPER_ADMIN") || req.user?.roles?.includes("OPERATION_ADMIN"));
  const result = await priceManagementService.getBestPrice(body.customerId, body.skuId, body.quantity, isAdmin, tenantId);
  if (result.error) {
    res.status(Number(result.error.code)).json({ code: result.error.code, message: result.error.message });
    return;
  }
  res.json(ok(result.data));
});

export const listCustomerBindings = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const status = req.query.status as string | undefined;
  const customerId = req.query.customerId ? Number(req.query.customerId) : undefined;

  const result = await priceManagementService.listCustomerBindings(page, pageSize, status, customerId, tenantId);
  res.json(ok(result));
});

export const createCustomerBinding = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    customerId: z.number().int().positive(),
    priceLevelId: z.number().int().positive(),
    applyReason: z.string().max(255).default(""),
    expireAt: z.string().nullable().default(null)
  }).parse(req.body);

  const result = await priceManagementService.createCustomerBinding(body, tenantId);
  if (result.error) {
    res.status(Number(result.error.code)).json({ code: result.error.code, message: result.error.message });
    return;
  }
  res.json(ok(result.data));
});

export const approveCustomerBinding = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const bindingId = Number(req.params.id);
  const result = await priceManagementService.approveCustomerBinding(bindingId, req.user!.id, tenantId);
  if (result.error) {
    res.status(Number(result.error.code)).json({ code: result.error.code, message: result.error.message });
    return;
  }
  res.json(ok(result.data));
});

export const rejectCustomerBinding = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const bindingId = Number(req.params.id);
  const result = await priceManagementService.rejectCustomerBinding(bindingId, req.user!.id, tenantId);
  if (result.error) {
    res.status(Number(result.error.code)).json({ code: result.error.code, message: result.error.message });
    return;
  }
  res.json(ok(result.data));
});

export const cancelCustomerBinding = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const bindingId = Number(req.params.id);
  const result = await priceManagementService.cancelCustomerBinding(bindingId, tenantId);
  if (result.error) {
    res.status(Number(result.error.code)).json({ code: result.error.code, message: result.error.message });
    return;
  }
  res.json(ok(result.data));
});

export const listChangeLogs = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const skuId = req.query.skuId ? Number(req.query.skuId) : undefined;
  const priceLevelId = req.query.priceLevelId ? Number(req.query.priceLevelId) : undefined;

  const result = await priceManagementService.listChangeLogs(page, pageSize, skuId, priceLevelId, tenantId);
  res.json(ok(result));
});
