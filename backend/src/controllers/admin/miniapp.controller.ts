import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { getSettlementType, type CustomerType } from "../../shared/fulfillment";
import * as service from "../../services/miniapp.service";

export const devLogin = (_req: any, res: any) => {
  const result = service.devLogin();
  res.json(ok(result));
};

export const devAuthLogin = (_req: any, res: any) => {
  const result = service.devAuthLogin();
  res.json(ok(result));
};

export const getProfile = (req: any, res: any) => {
  const customerType = String(req.headers["x-customer-type"] || "RETAIL");
  const result = service.getProfile(customerType);
  res.json(ok(result));
};

export const getProducts = asyncHandler(async (req, res) => {
  const storeId = Number(req.query.storeId || 1);
  const keyword = String(req.query.keyword || "");
  const customerType = String(req.headers["x-customer-type"] || "RETAIL");
  const result = await service.getProducts(storeId, keyword, customerType);
  res.json(ok(result));
});

export const createOrder = asyncHandler(async (req, res) => {
  const anonymousMemberId = String(req.headers["x-anonymous-member-id"] || "");
  const body = z.object({
    storeId: z.number(),
    fulfillmentType: z.enum(["DELIVERY", "PICKUP"]),
    receiverName: z.string().optional(),
    receiverMobile: z.string().optional(),
    receiverAddress: z.string().optional(),
    remark: z.string().optional(),
    items: z.array(z.object({
      skuId: z.number(),
      qty: z.number().int().positive().optional(),
      quantity: z.number().int().positive().optional()
    }).transform((item: any) => ({
      skuId: item.skuId,
      qty: item.qty ?? item.quantity ?? 0
    })).refine((item: any) => item.qty > 0, "qty or quantity is required")).min(1)
  }).parse(req.body);

  const customerType = String(req.headers["x-customer-type"] || "RETAIL");
  const settlementType = getSettlementType(customerType as CustomerType, String(req.headers["x-settlement-type"] || "ACCOUNT"));

  const result = await service.createOrder(req.tenantId!, body, customerType, anonymousMemberId, settlementType);
  res.json(ok(result));
});

export const getOrders = asyncHandler(async (req, res) => {
  const anonymousMemberId = String(req.headers["x-anonymous-member-id"] || "");
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const result = await service.getOrders(req.tenantId!, anonymousMemberId, page, pageSize);
  res.json(ok(result));
});

export const getOrderDetail = asyncHandler(async (req, res) => {
  const anonymousMemberId = String(req.headers["x-anonymous-member-id"] || "");
  const result = await service.getOrderDetail(req.tenantId!, req.params.orderNo, anonymousMemberId);
  res.json(ok(result));
});

export const confirmReceipt = asyncHandler(async (req, res) => {
  const result = await service.confirmReceipt(req.params.orderNo, req.tenantId as string);
  res.json(ok(result));
});

export const getStatements = asyncHandler(async (req, res) => {
  const anonymousMemberId = String(req.headers["x-anonymous-member-id"] || "");
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const result = await service.getStatements(req.tenantId!, anonymousMemberId, page, pageSize);
  res.json(ok(result));
});

export const getStatementDetail = asyncHandler(async (req, res) => {
  const anonymousMemberId = String(req.headers["x-anonymous-member-id"] || "");
  const result = await service.getStatementDetail(req.tenantId!, req.params.id, anonymousMemberId);
  res.json(ok(result));
});