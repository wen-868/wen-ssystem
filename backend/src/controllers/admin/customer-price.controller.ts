import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as customerPriceService from "../../services/admin/customer-price.service.js";

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
  const { customerId, skuId, customPrice, effectiveStart, effectiveEnd } = req.body;
  const result = await customerPriceService.createCustomerPrice({
    customerId, skuId, customPrice, effectiveStart, effectiveEnd,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const updateCustomerPrice = asyncHandler(async (req, res) => {
  const { customPrice, effectiveStart, effectiveEnd, status } = req.body;
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