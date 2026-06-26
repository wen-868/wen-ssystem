import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as svc from "../../services/store/other.service.js";

export const createHoldOrder = asyncHandler(async (req, res) => {
  const body = z.object({
    customerName: z.string().optional().default(""),
    customerMobile: z.string().optional().default(""),
    amount: z.number().default(0),
    remark: z.string().optional().default(""),
    items: z.array(z.object({
      skuId: z.number(), skuName: z.string(), quantity: z.number(),
      unitPrice: z.number(), subtotalAmount: z.number()
    })).default([])
  }).parse(req.body);
  const result = await svc.createHoldOrder({
    ...body, storeId: req.user?.storeId ?? 1, tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const listHoldOrders = asyncHandler(async (req, res) => {
  const result = await svc.listHoldOrders({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const restoreHoldOrder = asyncHandler(async (req, res) => {
  const result = await svc.restoreHoldOrder(req.params.holdNo, req.tenantId!);
  if (!result) { res.status(404).json({ code: "404", message: "挂单不存在" }); return; }
  res.json(ok(result));
});

export const deleteHoldOrder = asyncHandler(async (req, res) => {
  const result = await svc.deleteHoldOrder(req.params.holdNo, req.tenantId!);
  res.json(ok(result));
});

export const listCollectionLinks = asyncHandler(async (req, res) => {
  const result = await svc.listCollectionLinks({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const listPaymentOrders = asyncHandler(async (req, res) => {
  const result = await svc.listPaymentOrders({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const listRefundOrders = asyncHandler(async (req, res) => {
  const result = await svc.listRefundOrders({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});