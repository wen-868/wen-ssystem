import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as purchaseOrderService from "../../services/admin/purchase-order.service.js";
import * as purchaseInStockService from "../../services/admin/purchase-in-stock.service.js";
import * as purchaseReturnService from "../../services/admin/purchase-return.service.js";
import * as purchasePaymentService from "../../services/admin/purchase-payment.service.js";

const service = { ...purchaseOrderService, ...purchaseInStockService, ...purchaseReturnService, ...purchasePaymentService };

// ── Zod schemas ──
const purchaseItemSchema = z.object({
  skuId: z.number().int().positive(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  remark: z.string().max(200).optional(),
});

const createPurchaseOrderSchema = z.object({
  supplierId: z.number().int().positive(),
  storeId: z.number().int().positive(),
  expectedDate: z.string().optional(),
  remark: z.string().max(500).optional(),
  items: z.array(purchaseItemSchema).min(1),
});

const updatePurchaseOrderSchema = z.object({
  expectedDate: z.string().optional(),
  remark: z.string().max(500).optional(),
  items: z.array(purchaseItemSchema).min(1).optional(),
});

const purchaseInStockSchema = z.object({
  remark: z.string().max(500).optional(),
  items: z.array(z.object({
    skuId: z.number().int().positive(),
    quantity: z.number().positive(),
    batchNo: z.string().optional(),
    productionDate: z.string().optional(),
    expiryDate: z.string().optional(),
  })).min(1).optional(),
});

const purchaseReturnSchema = z.object({
  orderNo: z.string().optional(),
  stockNo: z.string().optional(),
  supplierId: z.number().int().positive(),
  storeId: z.number().int().positive(),
  remark: z.string().max(500).optional(),
  items: z.array(z.object({
    skuId: z.number().int().positive(),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
    reason: z.string().max(200).optional(),
  })).min(1),
});

export const listPurchaseOrders = asyncHandler(async (req, res) => {
  const result = await service.listPurchaseOrders({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!,
    supplierId: req.query.supplierId ? Number(req.query.supplierId) : undefined,
    orderStatus: req.query.orderStatus as string | undefined,
    operatorId: req.query.operatorId ? Number(req.query.operatorId) : undefined,
    dateStart: req.query.dateStart as string | undefined,
    dateEnd: req.query.dateEnd as string | undefined
  });
  res.json(ok(result));
});

export const getPurchaseOrderDetail = asyncHandler(async (req, res) => {
  const result = await service.getPurchaseOrderDetail(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});

export const createPurchaseOrder = asyncHandler(async (req, res) => {
  const body = createPurchaseOrderSchema.parse(req.body);
  const result = await service.createPurchaseOrder({
    supplierId: body.supplierId,
    storeId: body.storeId,
    tenantId: req.tenantId!,
    operatorId: req.user!.id ?? 0,
    expectedDate: body.expectedDate,
    remark: body.remark,
    items: body.items as unknown[]
  });
  res.json(ok(result));
});

export const updatePurchaseOrder = asyncHandler(async (req, res) => {
  const body = updatePurchaseOrderSchema.parse(req.body);
  const result = await service.updatePurchaseOrder(
    Number(req.params.id),
    {
      tenantId: req.tenantId!,
      expectedDate: body.expectedDate,
      remark: body.remark,
      items: body.items as unknown[]
    }
  );
  res.json(ok(result));
});

export const cancelPurchaseOrder = asyncHandler(async (req, res) => {
  const result = await service.cancelPurchaseOrder(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});

export const confirmPurchaseOrder = asyncHandler(async (req, res) => {
  const result = await service.confirmPurchaseOrder(
    Number(req.params.id),
    req.tenantId!,
    req.user!.id ?? 0
  );
  res.json(ok(result));
});

export const purchaseInStock = asyncHandler(async (req, res) => {
  const body = purchaseInStockSchema.parse(req.body);
  const result = await service.purchaseInStock(
    Number(req.params.id),
    {
      tenantId: req.tenantId!,
      operatorId: req.user!.id ?? 0,
      remark: body.remark,
      items: body.items as unknown[]
    }
  );
  res.json(ok(result));
});

export const listPurchaseInStocks = asyncHandler(async (req, res) => {
  const result = await service.listPurchaseInStocks({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!,
    supplierId: req.query.supplierId ? Number(req.query.supplierId) : undefined,
    stockStatus: req.query.stockStatus as string | undefined,
    dateStart: req.query.dateStart as string | undefined,
    dateEnd: req.query.dateEnd as string | undefined
  });
  res.json(ok(result));
});

export const getPurchaseInStockDetail = asyncHandler(async (req, res) => {
  const result = await service.getPurchaseInStockDetail(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});

export const purchaseReturn = asyncHandler(async (req, res) => {
  const body = purchaseReturnSchema.parse(req.body);
  const result = await service.purchaseReturn({
    orderNo: body.orderNo,
    stockNo: body.stockNo,
    supplierId: body.supplierId,
    storeId: body.storeId,
    tenantId: req.tenantId!,
    operatorId: req.user!.id ?? 0,
    remark: body.remark,
    items: body.items as unknown[]
  });
  res.json(ok(result));
});

export const listPurchaseReturns = asyncHandler(async (req, res) => {
  const result = await service.listPurchaseReturns({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!,
    supplierId: req.query.supplierId ? Number(req.query.supplierId) : undefined,
    returnStatus: req.query.returnStatus as string | undefined,
    dateStart: req.query.dateStart as string | undefined,
    dateEnd: req.query.dateEnd as string | undefined
  });
  res.json(ok(result));
});