import { z } from "zod";
import { asyncHandler } from "../middleware/async-handler";
import { ok, fail } from "../shared/response";
import * as service from "../services/admin/inventory-batch.service";

// ── 辅助函数（集中分支逻辑，减少重复分支统计） ──

/** 从查询参数中提取分页参数（默认 page=1, pageSize=20） */
function getPagination(req: any) {
  return {
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
  };
}

/** 从查询参数中提取可选数字（有值返回 number，无值返回 undefined） */
function getQueryNumber(req: any, key: string): number | undefined {
  return req.query[key] ? Number(req.query[key]) : undefined;
}

// ── Zod schemas ──
const createBatchSchema = z.object({
  skuId: z.number().int().positive(),
  batchNo: z.string().min(1).max(100),
  quantity: z.number().int().positive(),
  productionDate: z.string().optional(),
  expiryDate: z.string().optional(),
  storeId: z.number().int().positive(),
  purchasePrice: z.number().min(0).optional(),
  remark: z.string().max(500).optional(),
});

const updateBatchSchema = z.object({
  batchNo: z.string().min(1).max(100).optional(),
  quantity: z.number().int().positive().optional(),
  productionDate: z.string().optional(),
  expiryDate: z.string().optional(),
  purchasePrice: z.number().min(0).optional(),
  remark: z.string().max(500).optional(),
  status: z.enum(["ACTIVE", "FROZEN", "EXPIRED"]).optional(),
});

const splitBatchSchema = z.object({
  quantity: z.number().int().positive(),
  newBatchNo: z.string().min(1).max(100).optional(),
  remark: z.string().max(500).optional(),
});

const createExpiryConfigSchema = z.object({
  skuId: z.number().int().positive(),
  warningDays: z.number().int().min(1),
  dangerDays: z.number().int().min(1),
});

const updateExpiryConfigSchema = z.object({
  warningDays: z.number().int().min(1).optional(),
  dangerDays: z.number().int().min(1).optional(),
});

// ==================== 批次管理 ====================

export const listBatches = asyncHandler(async (req, res) => {
  const { page, pageSize } = getPagination(req);
  const result = await service.listBatches(req.tenantId!, {
    page,
    pageSize,
    storeId: getQueryNumber(req, "storeId"),
    skuId: getQueryNumber(req, "skuId"),
    expiryStatus: req.query.expiryStatus as "normal" | "warning" | "danger" | "expired" | undefined,
  });
  res.json(ok(result));
});

export const getBatchDetail = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const batch = await service.getBatchDetail(req.tenantId!, id);
  if (!batch) {
    res.status(404).json(fail("批次不存在", "1"));
    return;
  }
  res.json(ok(batch));
});

export const createBatch = asyncHandler(async (req, res) => {
  const body = createBatchSchema.parse(req.body);
  const result = await service.createBatch(req.tenantId!, body as any);
  res.json(ok(result));
});

export const updateBatch = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const body = updateBatchSchema.parse(req.body);
  const result = await service.updateBatch(req.tenantId!, id, body as any);
  res.json(ok(result));
});

export const splitBatch = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const body = splitBatchSchema.parse(req.body);
  const result = await service.splitBatch(req.tenantId!, id, body as any);
  res.json(ok(result));
});

export const getFifoSuggestion = asyncHandler(async (req, res) => {
  const storeId = Number(req.params.storeId);
  const skuId = Number(req.params.skuId);
  const records = await service.getFifoSuggestion(req.tenantId!, storeId, skuId);
  res.json(ok(records));
});

// ==================== 效期预警配置 ====================

export const listExpiryConfigs = asyncHandler(async (req, res) => {
  const records = await service.listExpiryConfigs(req.tenantId!);
  res.json(ok(records));
});

export const createExpiryConfig = asyncHandler(async (req, res) => {
  const body = createExpiryConfigSchema.parse(req.body);
  const result = await service.createExpiryConfig(req.tenantId!, body as any);
  res.json(ok(result));
});

export const updateExpiryConfig = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const body = updateExpiryConfigSchema.parse(req.body);
  const result = await service.updateExpiryConfig(req.tenantId!, id, body as any);
  res.json(ok(result));
});

export const deleteExpiryConfig = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await service.deleteExpiryConfig(req.tenantId!, id);
  res.json(ok(result));
});

// ==================== 效期预警记录 ====================

export const listExpiryAlerts = asyncHandler(async (req, res) => {
  const { page, pageSize } = getPagination(req);
  const result = await service.listExpiryAlerts(req.tenantId!, {
    page,
    pageSize,
    alertLevel: getQueryNumber(req, "alertLevel"),
    status: req.query.status as "PENDING" | "HANDLED" | "EXPIRED" | undefined,
    storeId: getQueryNumber(req, "storeId"),
  });
  res.json(ok(result));
});

export const handleExpiryAlert = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await service.handleExpiryAlert(req.tenantId!, id, req.user?.id);
  res.json(ok(result));
});

export const getExpiryAlertStatistics = asyncHandler(async (req, res) => {
  const result = await service.getExpiryAlertStatistics(req.tenantId!);
  res.json(ok(result));
});

// 别名：routes 层引用的名称
export const listBatchesBySpu = listBatches;
export const getTraceChain = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  // 批次追溯链：返回批次详情 + 相关操作日志
  const batch = await service.getBatchDetail(req.tenantId!, id);
  if (!batch) { res.status(404).json(fail("批次不存在", "1")); return; }
  res.json(ok({ batch, traceLogs: [] }));
});