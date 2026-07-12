import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import { getTenantId } from "../../middleware/tenant";
import * as traceRecordsService from "../../services/admin/trace-records.service";

export const generateTraceCodes = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    skuId: z.number().int().positive(),
    skuName: z.string().max(128).default(""),
    batchNo: z.string().max(64).default(""),
    quantity: z.number().int().min(1).default(1),
    productionDate: z.string().nullable().optional(),
    codeMode: z.enum(["ONE_PER_ITEM", "ONE_PER_BATCH"]).default("ONE_PER_BATCH"),
    categoryId: z.number().int().optional(),
    storeId: z.number().int().optional(),
    warehouseId: z.number().int().optional(),
    supplierId: z.number().int().optional(),
    shelfLifeDays: z.number().int().optional()
  }).parse(req.body);
  const result = await traceRecordsService.generateTraceCodes(
    body,
    req.user!.id ?? 0,
    req.user!.username ?? "system",
    tenantId
  );
  res.json(ok(result));
});

export const listTraceCodes = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const skuId = req.query.skuId ? Number(req.query.skuId) : undefined;
  const batchNo = req.query.batchNo as string | undefined;
  const currentStatus = req.query.currentStatus as string | undefined;
  const storeId = req.query.storeId ? Number(req.query.storeId) : undefined;
  const result = await traceRecordsService.listTraceCodes(
    page, pageSize, skuId, batchNo, currentStatus, storeId, tenantId
  );
  res.json(ok(result));
});

export const getTraceCodeDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const traceCode = req.params.traceCode;
  const result = await traceRecordsService.getTraceCodeDetail(traceCode, tenantId);
  if (!result) {
    res.status(404).json(fail("追溯码不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const updateTraceCodeStatus = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const traceCode = req.params.traceCode;
  const body = z.object({
    status: z.enum(["PRODUCED", "PURCHASED", "TRANSFERRED", "ALLOCATED", "ON_SHELF",
      "SOLD", "WHOLESALE_SOLD", "DELIVERING", "DELIVERED", "RETURNED",
      "DESTROYED", "EXPIRED", "RECALLED"]),
    location: z.string().max(128).optional(),
    storeId: z.number().int().optional(),
    warehouseId: z.number().int().optional(),
    orderId: z.number().int().optional(),
    remark: z.string().max(255).optional(),
    qualityCheckResult: z.enum(["PASS", "FAIL", "PENDING"]).optional()
  }).parse(req.body);
  const result = await traceRecordsService.updateTraceCodeStatus(
    traceCode,
    body,
    req.user!.id ?? 0,
    req.user!.username ?? "system",
    req.ip || "",
    tenantId
  );
  if (!result) {
    res.status(404).json(fail("追溯码不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const getTraceCodeStatistics = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await traceRecordsService.getTraceCodeStatistics(tenantId);
  res.json(ok(result));
});

export const queryTraceChain = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const traceCode = req.params.traceCode;
  const result = await traceRecordsService.queryTraceChain(traceCode, tenantId);
  if (!result) {
    res.status(404).json(fail("追溯码不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const verifyTraceCode = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    traceCode: z.string().min(1),
    scanType: z.enum(["CONSUMER", "BUSINESS", "PDA", "ADMIN"]).default("CONSUMER"),
    userId: z.number().int().optional()
  }).parse(req.body);
  const result = await traceRecordsService.verifyTraceCode(
    body.traceCode,
    body.scanType,
    body.userId,
    req.ip || "",
    tenantId
  );
  res.json(ok(result));
});

export const createRecall = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    recallType: z.enum(["BATCH", "CATEGORY", "SKU", "SUPPLIER", "GLOBAL"]),
    targetValue: z.string().max(128),
    targetName: z.string().max(128).default(""),
    reason: z.string().min(1).max(255),
    notifyContent: z.string().optional()
  }).parse(req.body);
  const result = await traceRecordsService.createRecall(body, req.user!.id, tenantId);
  res.json(ok(result));
});

export const listRecalls = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const status = req.query.status as string | undefined;
  const recallType = req.query.recallType as string | undefined;
  const result = await traceRecordsService.listRecalls(page, pageSize, status, recallType, tenantId);
  res.json(ok(result));
});

export const getRecallDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const recallNo = req.params.recallNo;
  const result = await traceRecordsService.getRecallDetail(recallNo, tenantId);
  if (!result) {
    res.status(404).json(fail("召回记录不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const executeRecall = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const recallNo = req.params.recallNo;
  const result = await traceRecordsService.executeRecall(
    recallNo,
    req.user!.id ?? 0,
    req.user!.username ?? "system",
    tenantId
  );
  if ((result as any).notFound) {
    res.status(404).json({ message: "追踪记录不存在" });
    return;
  }
  if ((result as any).alreadyEnded) {
    res.status(400).json(fail("该召回已结束，无法执行", "400"));
    return;
  }
  res.json(ok(result));
});

export const completeRecall = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const recallNo = req.params.recallNo;
  const body = z.object({
    totalNotified: z.number().int().min(0).default(0),
    totalReturned: z.number().int().min(0).default(0)
  }).parse(req.body);
  const result = await traceRecordsService.completeRecall(recallNo, body, tenantId);
  if ((result as any).notFound) {
    res.status(404).json({ message: "追踪记录不存在" });
    return;
  }
  if ((result as any).alreadyEnded) {
    res.status(400).json(fail("该召回已结束", "400"));
    return;
  }
  res.json(ok(result));
});

export const consumerQueryTrace = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const traceCode = req.params.traceCode;
  const result = await traceRecordsService.consumerQueryTrace(traceCode, tenantId);
  if (!result) {
    res.status(404).json(fail("追溯码不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const consumerVerifyTraceCode = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const body = z.object({
    traceCode: z.string().min(1),
    userId: z.number().int().optional()
  }).parse(req.body);
  const result = await traceRecordsService.consumerVerifyTraceCode(
    body.traceCode,
    body.userId,
    req.ip || "",
    tenantId
  );
  res.json(ok(result));
});
