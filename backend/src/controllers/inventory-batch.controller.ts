import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import * as service from "../services/admin/inventory-batch.service.js";

// ==================== 批次管理 ====================

export const listBatches = asyncHandler(async (req, res) => {
  const result = await service.listBatches({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!,
    storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
    skuId: req.query.skuId ? Number(req.query.skuId) : undefined,
    expiryStatus: req.query.expiryStatus as "normal" | "warning" | "danger" | "expired" | undefined,
  });
  res.json(ok(result));
});

export const getBatchDetail = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const batch = await service.getBatchDetail(id, req.tenantId!);
  if (!batch) {
    res.status(404).json({ code: "1", message: "批次不存在" });
    return;
  }
  res.json(ok(batch));
});

export const createBatch = asyncHandler(async (req, res) => {
  const result = await service.createBatch(req.body, req.tenantId!);
  res.json(ok(result));
});

export const updateBatch = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await service.updateBatch(id, req.body, req.tenantId!);
  res.json(ok(result));
});

export const splitBatch = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await service.splitBatch(id, req.body, req.tenantId!);
  res.json(ok(result));
});

export const getFifoSuggestion = asyncHandler(async (req, res) => {
  const storeId = Number(req.params.storeId);
  const skuId = Number(req.params.skuId);
  const records = await service.getFifoSuggestion(storeId, skuId, req.tenantId!);
  res.json(ok(records));
});

// ==================== 效期预警配置 ====================

export const listExpiryConfigs = asyncHandler(async (req, res) => {
  const records = await service.listExpiryConfigs(req.tenantId!);
  res.json(ok(records));
});

export const createExpiryConfig = asyncHandler(async (req, res) => {
  const result = await service.createExpiryConfig(req.body, req.tenantId!);
  res.json(ok(result));
});

export const updateExpiryConfig = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await service.updateExpiryConfig(id, req.body, req.tenantId!);
  res.json(ok(result));
});

export const deleteExpiryConfig = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await service.deleteExpiryConfig(id, req.tenantId!);
  res.json(ok(result));
});

// ==================== 效期预警记录 ====================

export const listExpiryAlerts = asyncHandler(async (req, res) => {
  const result = await service.listExpiryAlerts({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!,
    alertLevel: req.query.alertLevel ? Number(req.query.alertLevel) : undefined,
    status: req.query.status as "PENDING" | "HANDLED" | "EXPIRED" | undefined,
    storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
  });
  res.json(ok(result));
});

export const handleExpiryAlert = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await service.handleExpiryAlert(id, req.body, req.tenantId!, req.user!.id);
  res.json(ok(result));
});

export const getExpiryAlertStatistics = asyncHandler(async (req, res) => {
  const result = await service.getExpiryAlertStatistics(req.tenantId!);
  res.json(ok(result));
});