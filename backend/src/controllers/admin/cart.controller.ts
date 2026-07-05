import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler.js";
import { ok, fail } from "../../shared/response.js";
import * as cartService from "../../services/admin/cart.service.js";

function getCustomerId(req: any): number {
  return Number(req.user!.id) || 1;
}

// ========== 购物车 ==========

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

// ========== 结算 ==========

export const checkoutPreview = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const customerType = String(req.headers["x-customer-type"] || "RETAIL");
  const body = z.object({
    skuIds: z.array(z.number().int().positive()).optional(),
    storeId: z.number().int().positive().default(1),
    couponId: z.number().int().positive().optional(),
    fullReductionId: z.number().int().positive().optional()
  }).parse(req.body);
  const result = await cartService.checkoutPreview({
    tenantId,
    customerId,
    customerType,
    skuIds: body.skuIds,
    storeId: body.storeId,
    couponId: body.couponId,
    fullReductionId: body.fullReductionId
  });
  if (!result.success) {
    res.status(400).json(fail(result.message || "结算失败"));
    return;
  }
  res.json(ok(result.data));
});

export const createCheckoutOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const customerType = String(req.headers["x-customer-type"] || "RETAIL");
  const body = z.object({
    storeId: z.number().int().positive().default(1),
    fulfillmentType: z.enum(["DELIVERY", "PICKUP"]).default("DELIVERY"),
    receiverName: z.string().optional(),
    receiverMobile: z.string().optional(),
    receiverAddress: z.string().optional(),
    remark: z.string().optional(),
    skuIds: z.array(z.number().int().positive()).optional(),
    couponId: z.number().int().positive().optional(),
    fullReductionId: z.number().int().positive().optional()
  }).parse(req.body);
  const settlementType = customerType === "WHOLESALE"
    ? String(req.headers["x-settlement-type"] || "ACCOUNT")
    : "CASH";
  const order = await cartService.createCheckoutOrder({
    tenantId,
    customerId,
    customerType,
    storeId: body.storeId,
    fulfillmentType: body.fulfillmentType,
    receiverName: body.receiverName,
    receiverMobile: body.receiverMobile,
    receiverAddress: body.receiverAddress,
    remark: body.remark,
    skuIds: body.skuIds,
    couponId: body.couponId,
    fullReductionId: body.fullReductionId,
    settlementType
  });
  res.json(ok(order));
});