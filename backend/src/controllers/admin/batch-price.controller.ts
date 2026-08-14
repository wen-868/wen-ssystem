import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as batchPriceService from "../../services/admin/batch-price.service";

const filterSchema = z.object({
  categoryId: z.number().int().optional(),
  brand: z.string().optional(),
  supplierId: z.number().int().optional(),
  priceLevelId: z.number().int().optional(),
  keyword: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  skuIds: z.array(z.number().int()).optional()
});

const adjustmentSchema = z.object({
  field: z.enum(["retail_price", "wholesale_price", "cost_price", "miniapp_price", "store_price"]),
  method: z.enum(["FIXED", "PERCENTAGE"]),
  value: z.number().min(0),
  direction: z.enum(["INCREASE", "DECREASE"])
});

export const previewBatchAdjustment = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    filter: filterSchema,
    adjustment: adjustmentSchema,
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(50)
  }).parse(req.body);

  const result = await batchPriceService.previewBatchPriceAdjustment(
    body.filter,
    body.adjustment,
    tenantId,
    body.page,
    body.pageSize
  );

  res.json(ok(result));
});

export const executeBatchAdjustment = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;
  const body = z.object({
    filter: filterSchema,
    adjustment: adjustmentSchema,
    reason: z.string().max(255).default("批量价格调整")
  }).parse(req.body);

  const result = await batchPriceService.executeBatchPriceAdjustment(
    body.filter,
    body.adjustment,
    body.reason,
    userId,
    tenantId
  );

  res.json(ok(result));
});

export const listBatchLogs = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const batchNo = req.query.batchNo as string | undefined;
  const priceType = req.query.priceType as string | undefined;
  const operatorId = req.query.operatorId ? Number(req.query.operatorId) : undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  const result = await batchPriceService.listBatchPriceLogs(
    page,
    pageSize,
    tenantId,
    { batchNo, priceType, operatorId, startDate, endDate }
  );

  res.json(ok(result));
});

export const getBatchDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const batchNo = req.params.batchNo;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 50);

  const result = await batchPriceService.getBatchPriceDetail(
    batchNo,
    tenantId,
    page,
    pageSize
  );

  res.json(ok(result));
});
