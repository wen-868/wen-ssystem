import { asyncHandler } from "../shared/async-handler.js";
import { ok, fail } from "../shared/response.js";
import * as service from "../services/admin/stock-check.service.js";

// ==================== Admin 盘点 ====================

export const create = asyncHandler(async (req, res) => {
  const result = await service.createStockCheck(req.body, req.tenantId!);
  res.json(ok(result));
});

export const list = asyncHandler(async (req, res) => {
  const result = await service.listStockChecks({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!,
    storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
    status: req.query.status as "DRAFT" | "CHECKING" | "COMPLETED" | "CANCELLED" | undefined,
  });
  res.json(ok(result));
});

export const getStatistics = asyncHandler(async (req, res) => {
  const result = await service.getStockCheckStatistics(req.tenantId!);
  res.json(ok(result));
});

export const getDetail = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await service.getStockCheckDetail(id, req.tenantId!);
  if (!result) {
    res.status(404).json(fail("盘点单不存在"));
    return;
  }
  res.json(ok(result));
});

export const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await service.updateStockCheck(id, req.body, req.tenantId!);
  res.json(ok(result));
});

export const start = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await service.startStockCheck(id, req.tenantId!);
  res.json(ok(result));
});

export const complete = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await service.completeStockCheck(id, req.tenantId!);
  res.json(ok(result));
});

export const cancel = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await service.cancelStockCheck(id, req.tenantId!);
  res.json(ok(result));
});

export const handleDiff = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await service.handleDiff(id, req.body, req.tenantId!, req.user!.id);
  res.json(ok(result));
});

// ==================== Store 盘点 ====================

export const getMyList = asyncHandler(async (req, res) => {
  const storeId = req.user?.storeId;
  if (!storeId) {
    res.status(400).json(fail("未关联门店"));
    return;
  }
  const records = await service.getMyStockChecks(storeId, req.tenantId!);
  res.json(ok(records));
});

export const updateItem = asyncHandler(async (req, res) => {
  const checkId = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  const result = await service.updateItem(checkId, itemId, req.body, req.tenantId!);
  res.json(ok(result));
});

export const submit = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await service.submitStockCheck(id, req.tenantId!);
  res.json(ok(result));
});