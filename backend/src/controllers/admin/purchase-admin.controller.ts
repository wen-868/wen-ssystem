import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as service from "../../services/admin/purchase-admin.service.js";

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
  const result = await service.createPurchaseOrder({
    supplierId: req.body.supplierId,
    storeId: req.body.storeId,
    tenantId: req.tenantId!,
    operatorId: req.user!.id ?? 0,
    expectedDate: req.body.expectedDate,
    remark: req.body.remark,
    items: req.body.items
  });
  res.json(ok(result));
});

export const updatePurchaseOrder = asyncHandler(async (req, res) => {
  const result = await service.updatePurchaseOrder(
    Number(req.params.id),
    {
      tenantId: req.tenantId!,
      expectedDate: req.body.expectedDate,
      remark: req.body.remark,
      items: req.body.items
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
  const result = await service.purchaseInStock(
    Number(req.params.id),
    {
      tenantId: req.tenantId!,
      operatorId: req.user!.id ?? 0,
      remark: req.body.remark,
      items: req.body.items
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
  const result = await service.purchaseReturn({
    orderNo: req.body.orderNo,
    stockNo: req.body.stockNo,
    supplierId: req.body.supplierId,
    storeId: req.body.storeId,
    tenantId: req.tenantId!,
    operatorId: req.user!.id ?? 0,
    remark: req.body.remark,
    items: req.body.items
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