import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as customerPriceService from "../../services/admin/customer-price.service";

const createCustomerPriceSchema = z.object({
  customerId: z.number().int().positive(),
  skuId: z.number().int().positive(),
  customPrice: z.number().min(0),
  effectiveStart: z.string().optional(),
  effectiveEnd: z.string().optional(),
});

const updateCustomerPriceSchema = z.object({
  customPrice: z.number().min(0).optional(),
  effectiveStart: z.string().optional(),
  effectiveEnd: z.string().optional(),
  status: z.number().int().optional(),
});

export const listCustomerPrices = asyncHandler(async (req, res) => {
  const result = await customerPriceService.listCustomerPrices({
    customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
    skuId: req.query.skuId ? Number(req.query.skuId) : undefined,
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const createCustomerPrice = asyncHandler(async (req, res) => {
  const body = createCustomerPriceSchema.parse(req.body);
  const { customerId, skuId, customPrice, effectiveStart, effectiveEnd } = body;
  const result = await customerPriceService.createCustomerPrice({
    customerId, skuId, customPrice, effectiveStart, effectiveEnd,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const updateCustomerPrice = asyncHandler(async (req, res) => {
  const body = updateCustomerPriceSchema.parse(req.body);
  const { customPrice, effectiveStart, effectiveEnd, status } = body;
  const result = await customerPriceService.updateCustomerPrice(Number(req.params.id), {
    customPrice, effectiveStart, effectiveEnd, status,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const deleteCustomerPrice = asyncHandler(async (req, res) => {
  const result = await customerPriceService.deleteCustomerPrice(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});