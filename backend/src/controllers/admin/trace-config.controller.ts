import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler.js";
import { ok, fail } from "../../shared/response.js";
import * as traceConfigService from "../../services/admin/trace-config.service.js";

export const listConfigs = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const configLevel = req.query.configLevel as string | undefined;
  const traceEnabled = req.query.traceEnabled !== undefined ? Number(req.query.traceEnabled) : undefined;
  const result = await traceConfigService.listConfigs(page, pageSize, configLevel, traceEnabled, tenantId);
  res.json(ok(result));
});

export const createConfig = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    configLevel: z.enum(["CATEGORY", "SKU", "GLOBAL"]),
    targetId: z.number().int().positive(),
    targetName: z.string().max(128).default(""),
    traceEnabled: z.number().int().min(0).max(1).default(0),
    forceEnabled: z.number().int().min(0).max(1).default(0),
    codeMode: z.enum(["ONE_PER_ITEM", "ONE_PER_BATCH", "BATCH_ONLY"]).default("ONE_PER_BATCH"),
    codePrefix: z.string().max(16).default("TR"),
    autoGenerate: z.number().int().min(0).max(1).default(1),
    shelfLifeDays: z.number().int().min(1).default(365),
    remark: z.string().max(255).default("")
  }).parse(req.body);
  const result = await traceConfigService.createConfig(body, tenantId);
  res.json(ok(result));
});

export const updateConfig = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const configId = Number(req.params.id);
  const body = z.object({
    targetName: z.string().max(128).optional(),
    traceEnabled: z.number().int().min(0).max(1).optional(),
    forceEnabled: z.number().int().min(0).max(1).optional(),
    codeMode: z.enum(["ONE_PER_ITEM", "ONE_PER_BATCH", "BATCH_ONLY"]).optional(),
    codePrefix: z.string().max(16).optional(),
    autoGenerate: z.number().int().min(0).max(1).optional(),
    shelfLifeDays: z.number().int().min(1).optional(),
    remark: z.string().max(255).optional(),
    status: z.number().int().min(0).max(1).optional()
  }).parse(req.body);
  const result = await traceConfigService.updateConfig(configId, body, tenantId);
  if (!result) {
    res.status(404).json(fail("配置不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const deleteConfig = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const configId = Number(req.params.id);
  const success = await traceConfigService.deleteConfig(configId, tenantId);
  if (!success) {
    res.status(404).json(fail("配置不存在", "404"));
    return;
  }
  res.json(ok({ deleted: true }));
});

export const checkSkuTrace = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    skuId: z.number().int().positive(),
    categoryId: z.number().int().optional()
  }).parse(req.body);
  const result = await traceConfigService.checkSkuTrace(body.skuId, body.categoryId, tenantId);
  res.json(ok(result));
});
