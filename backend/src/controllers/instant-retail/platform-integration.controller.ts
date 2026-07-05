import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler.js";
import { ok, fail } from "../../shared/response.js";
import * as platformIntegrationService from "../../services/instant-retail/platform-integration.service.js";

const upsertConfigSchema = z.object({
  platform: z.enum(["JD", "MEITUAN", "ELEME"]),
  appKey: z.string().min(1),
  appSecret: z.string().min(1),
  shopId: z.string().optional(),
  shopName: z.string().optional(),
  enabled: z.boolean().optional(),
});

const syncBodySchema = z.object({
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

export const handleJdWebhook = asyncHandler(async (req, res) => {
  const rawBody = req.body ?? {};
  const signature = String(req.headers["x-signature"] ?? req.headers["signature"] ?? req.query.sign ?? "");
  const timestamp = String(req.headers["x-timestamp"] ?? req.query.timestamp ?? "");
  const result = await platformIntegrationService.handleWebhook("JD", rawBody, signature, timestamp);
  res.status(result.status).json(result.response);
});

export const handleMeituanWebhook = asyncHandler(async (req, res) => {
  const rawBody = req.body ?? {};
  const signature = String(req.headers["x-signature"] ?? req.headers["signature"] ?? req.query.sign ?? "");
  const timestamp = String(req.headers["x-timestamp"] ?? req.query.timestamp ?? "");
  const result = await platformIntegrationService.handleWebhook("MEITUAN", rawBody, signature, timestamp);
  res.status(result.status).json(result.response);
});

export const handleElemeWebhook = asyncHandler(async (req, res) => {
  const rawBody = req.body ?? {};
  const signature = String(req.headers["x-signature"] ?? req.headers["signature"] ?? req.query.sign ?? "");
  const timestamp = String(req.headers["x-timestamp"] ?? req.query.timestamp ?? "");
  const result = await platformIntegrationService.handleWebhook("ELEME", rawBody, signature, timestamp);
  res.status(result.status).json(result.response);
});

export const getPlatforms = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await platformIntegrationService.getPlatforms(tenantId);
  res.json(ok(result));
});

export const getConfigs = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await platformIntegrationService.getConfigs(tenantId);
  res.json(ok(result));
});

export const getConfigByPlatform = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await platformIntegrationService.getConfigByPlatform(req.params.platform, tenantId);
  if (!result) {
    res.status(404).json(fail("平台配置不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const upsertConfig = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = upsertConfigSchema.parse(req.body);
  const result = await platformIntegrationService.upsertConfig(body, tenantId);
  res.json(ok(result));
});

export const testConnection = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await platformIntegrationService.testConnection(req.params.platform, tenantId);
  if (!result.found) {
    res.status(404).json(fail("平台配置不存在", "404"));
    return;
  }
  if (!result.connected) {
    res.status(502).json(fail(`连接失败: ${result.error}`, "502"));
    return;
  }
  res.json(ok({ platform: result.platform, connected: true, tokenUpdated: result.tokenUpdated }));
});

export const syncOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = syncBodySchema.parse(req.body);
  const result = await platformIntegrationService.syncOrders(req.params.platform, body, tenantId);
  if (!result.found) {
    res.status(404).json(fail("平台配置不存在", "404"));
    return;
  }
  res.json(ok({ platform: result.platform, synced: result.synced, hasMore: result.hasMore }));
});

export const syncProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = syncBodySchema.parse(req.body);
  const result = await platformIntegrationService.syncProducts(req.params.platform, body, tenantId);
  if (!result.found) {
    res.status(404).json(fail("平台配置不存在", "404"));
    return;
  }
  res.json(ok({ platform: result.platform, synced: result.synced, hasMore: result.hasMore }));
});

export const deleteConfig = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await platformIntegrationService.deleteConfig(req.params.platform, tenantId);
  res.json(ok(result));
});
