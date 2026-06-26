import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import * as service from "../services/admin/store-control.service.js";

// ==================== Admin 管控配置 ====================

export const listConfigs = asyncHandler(async (req, res) => {
  const records = await service.listConfigs(req.tenantId!);
  res.json(ok(records));
});

export const getConfig = asyncHandler(async (req, res) => {
  const storeId = Number(req.params.storeId);
  const config = await service.getConfig(storeId, req.tenantId!);
  res.json(ok(config));
});

export const updateConfig = asyncHandler(async (req, res) => {
  const storeId = Number(req.params.storeId);
  const result = await service.updateConfig(storeId, req.body, req.tenantId!);
  res.json(ok(result));
});

// ==================== Admin 门店操作 ====================

export const openStore = asyncHandler(async (req, res) => {
  const storeId = Number(req.params.storeId);
  const result = await service.openStore(storeId, req.tenantId!, req.user!.id);
  res.json(ok(result));
});

export const closeStore = asyncHandler(async (req, res) => {
  const storeId = Number(req.params.storeId);
  const result = await service.closeStore(storeId, req.tenantId!, req.user!.id);
  res.json(ok(result));
});

export const suspendStore = asyncHandler(async (req, res) => {
  const storeId = Number(req.params.storeId);
  const result = await service.suspendStore(storeId, req.tenantId!, req.user!.id, req.body.reason);
  res.json(ok(result));
});

export const resumeStore = asyncHandler(async (req, res) => {
  const storeId = Number(req.params.storeId);
  const result = await service.resumeStore(storeId, req.tenantId!, req.user!.id);
  res.json(ok(result));
});

// ==================== Admin 状态日志 ====================

export const listStatusLogs = asyncHandler(async (req, res) => {
  const result = await service.listStatusLogs({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!,
    storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
    changeType: req.query.changeType as "MANUAL" | "SCHEDULED" | "AUTO" | undefined,
  });
  res.json(ok(result));
});

// ==================== Store 门店端 ====================

export const getStoreStatus = asyncHandler(async (req, res) => {
  const storeId = req.user?.storeId ?? 1;
  const result = await service.getStoreStatus(storeId, req.tenantId!);
  res.json(ok(result));
});

export const listMyLogs = asyncHandler(async (req, res) => {
  const storeId = req.user?.storeId ?? 1;
  const result = await service.listMyLogs({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    storeId,
    tenantId: req.tenantId!,
  });
  res.json(ok(result));
});