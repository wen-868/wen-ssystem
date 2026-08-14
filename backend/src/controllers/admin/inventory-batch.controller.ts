import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as service from "../../services/admin/inventory-batch.service";
import { z } from "zod";

// ==================== 批次管理 ====================

export const listBatches = asyncHandler(async (req, res) => {
  const params = z.object({
    page: z.coerce.number().default(1),
    pageSize: z.coerce.number().default(20),
    storeId: z.coerce.number().optional(),
    skuId: z.coerce.number().optional(),
    expiryStatus: z.enum(["normal", "warning", "danger", "expired"]).optional()
  }).parse(req.query);

  const result = await service.listBatches(req.tenantId!, params);
  res.json(ok(result));
});

export const getBatchDetail = asyncHandler(async (req, res) => {
  const id = z.coerce.number().parse(req.params.id);
  const batch = await service.getBatchDetail(req.tenantId!, id);
  if (!batch) {
    res.status(404).json(fail("批次不存在", "1"));
    return;
  }
  res.json(ok(batch));
});

export const createBatch = asyncHandler(async (req, res) => {
  const body = z.object({
    storeId: z.number(),
    skuId: z.number(),
    batchNo: z.string().min(1),
    quantity: z.number().int().positive(),
    productionDate: z.string().optional(),
    expiryDate: z.string().optional(),
    costPrice: z.number().optional(),
    supplierId: z.number().optional(),
    inboundOrderId: z.number().optional()
  }).parse(req.body);

  const result = await service.createBatch(req.tenantId!, body);
  res.json(ok({ batchId: result }));
});

export const updateBatch = asyncHandler(async (req, res) => {
  const id = z.coerce.number().parse(req.params.id);
  const body = z.object({
    quantity: z.number().int().positive().optional(),
    productionDate: z.string().optional(),
    expiryDate: z.string().optional(),
    costPrice: z.number().optional()
  }).parse(req.body);

  await service.updateBatch(req.tenantId!, id, body);
  res.json(ok({ batchId: id }));
});

export const splitBatch = asyncHandler(async (req, res) => {
  const id = z.coerce.number().parse(req.params.id);
  const body = z.object({
    splitQuantity: z.number().int().positive(),
    newBatchNo: z.string().min(1)
  }).parse(req.body);

  const result = await service.splitBatch(req.tenantId!, id, body);
  res.json(ok({ newBatchId: result }));
});

export const getFifoSuggestion = asyncHandler(async (req, res) => {
  const storeId = z.coerce.number().parse(req.params.storeId);
  const skuId = z.coerce.number().parse(req.params.skuId);
  const records = await service.getFifoSuggestion(req.tenantId!, storeId, skuId);
  res.json(ok(records));
});

// ==================== 批次追溯 ====================

export const getBatchTrace = asyncHandler(async (req, res) => {
  const trace = await service.getBatchTrace(req.tenantId!, Number(req.params.id));
  res.json(ok(trace));
});

export const getProductBatches = asyncHandler(async (req, res) => {
  const rows = await service.getProductBatches(req.tenantId!, Number(req.params.spuId));
  res.json(ok(rows));
});

// ==================== 效期预警配置 ====================

export const listExpiryConfigs = asyncHandler(async (req, res) => {
  const records = await service.listExpiryConfigs(req.tenantId!);
  res.json(ok(records));
});

export const createExpiryConfig = asyncHandler(async (req, res) => {
  const body = z.object({
    alertLevel: z.number().int(),
    levelName: z.string().min(1),
    daysBeforeExpiry: z.number().int().positive(),
    action: z.enum(["REMIND", "RESTRICT", "BLOCK"]),
    color: z.string(),
    enabled: z.boolean().default(true),
    description: z.string().default("")
  }).parse(req.body);

  const result = await service.createExpiryConfig(req.tenantId!, body);
  res.json(ok({ configId: result }));
});

export const updateExpiryConfig = asyncHandler(async (req, res) => {
  const id = z.coerce.number().parse(req.params.id);
  const body = z.object({
    levelName: z.string().optional(),
    daysBeforeExpiry: z.number().int().positive().optional(),
    action: z.enum(["REMIND", "RESTRICT", "BLOCK"]).optional(),
    color: z.string().optional(),
    enabled: z.boolean().optional(),
    description: z.string().optional()
  }).parse(req.body);

  await service.updateExpiryConfig(req.tenantId!, id, body);
  res.json(ok({ configId: id }));
});

export const deleteExpiryConfig = asyncHandler(async (req, res) => {
  const id = z.coerce.number().parse(req.params.id);
  await service.deleteExpiryConfig(req.tenantId!, id);
  res.json(ok({ configId: id }));
});

// ==================== 效期预警记录 ====================

export const listExpiryAlerts = asyncHandler(async (req, res) => {
  const params = z.object({
    page: z.coerce.number().default(1),
    pageSize: z.coerce.number().default(20),
    alertLevel: z.coerce.number().optional(),
    status: z.enum(["PENDING", "HANDLED", "EXPIRED"]).optional(),
    storeId: z.coerce.number().optional()
  }).parse(req.query);

  const result = await service.listExpiryAlerts(req.tenantId!, params);
  res.json(ok(result));
});

export const handleExpiryAlert = asyncHandler(async (req, res) => {
  const id = z.coerce.number().parse(req.params.id);
  await service.handleExpiryAlert(req.tenantId!, id, req.user!.id);
  res.json(ok({ alertId: id }));
});

export const getExpiryAlertStatistics = asyncHandler(async (req, res) => {
  const result = await service.getExpiryAlertStatistics(req.tenantId!);
  res.json(ok(result));
});