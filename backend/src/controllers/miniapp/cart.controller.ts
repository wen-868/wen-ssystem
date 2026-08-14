import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as cartService from "../../services/miniapp/cart.service";

function getCustomerId(req: any): number {
  return Number(req.user!.id) || 1;
}

export const getCartList = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const customerType = String(req.headers["x-customer-type"] || "RETAIL");
  const result = await cartService.getCartList(tenantId, customerId, customerType);
  res.json(ok(result));
});

export const addToCart = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const body = z.object({
    skuId: z.number().int().positive(),
    quantity: z.number().int().positive().default(1)
  }).parse(req.body);

  const result = await cartService.addToCart(tenantId, customerId, body.skuId, body.quantity);
  if (!result.success) {
    res.status(400).json(fail(result.message));
    return;
  }
  res.json(ok({ message: result.message }));
});

export const updateCartItemQuantity = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const skuId = Number(req.params.skuId);
  const body = z.object({
    quantity: z.number().int().min(0)
  }).parse(req.body);

  const result = await cartService.updateCartItemQuantity(tenantId, customerId, skuId, body.quantity);
  if (!result.success) {
    res.status(404).json(fail(result.message));
    return;
  }
  res.json(ok({ message: result.message }));
});

export const deleteCartItem = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const skuId = Number(req.params.skuId);
  const result = await cartService.deleteCartItem(tenantId, customerId, skuId);
  res.json(ok(result));
});

export const clearCart = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const result = await cartService.clearCart(tenantId, customerId);
  res.json(ok(result));
});

export const getCartCount = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const result = await cartService.getCartCount(tenantId, customerId);
  res.json(ok(result));
});
