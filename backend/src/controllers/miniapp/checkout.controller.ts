import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import { getSettlementType, type CustomerType } from "../../shared/fulfillment";
import * as checkoutService from "../../services/miniapp/checkout.service";

function getCustomerId(req: any): number {
  return Number(req.user!.id) || 1;
}

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

  const result = await checkoutService.checkoutPreview({
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

  const settlementType = getSettlementType(customerType as CustomerType, String(req.headers["x-settlement-type"] || "ACCOUNT"));

  const order = await checkoutService.createCheckoutOrder({
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
