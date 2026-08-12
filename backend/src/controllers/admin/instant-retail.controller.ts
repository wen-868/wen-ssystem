/**
 * 即时零售 Controller 层
 * 只做参数提取和响应封装，业务逻辑委托给 Service
 */

import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as instantRetailService from "../../services/admin/instant-retail.service";
import * as retailShopSvc from "../../services/instant-retail/retail-shop.service";

// ── 辅助函数（集中分支逻辑，减少重复分支统计） ──

/** 从请求中提取 webhook 参数（body/signature/timestamp） */
function extractWebhookParams(req: any) {
  const rawBody = req.body ?? {};
  const signature = String(req.headers["x-signature"] ?? req.headers["signature"] ?? req.query.sign ?? "");
  const timestamp = String(req.headers["x-timestamp"] ?? req.query.timestamp ?? "");
  return { rawBody, signature, timestamp };
}

/** 从查询参数中提取 storeId（有值转 number，无值返回 undefined） */
function getStoreIdFromQuery(req: any): number | undefined {
  return req.query.storeId ? Number(req.query.storeId) : undefined;
}

/** 从查询参数中提取分页参数（默认 page=1, pageSize=20） */
function getPagination(req: any) {
  return {
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
  };
}

// ── Zod schemas ──
const upsertConfigSchema = z.object({
  platform: z.enum(["JD", "MEITUAN", "ELEME"]),
  appKey: z.string().min(1),
  appSecret: z.string().min(1),
  shopId: z.string().optional(),
  shopName: z.string().optional(),
  enabled: z.boolean().optional(),
});

const saveShopConfigSchema = z.object({
  shopName: z.string().min(1).max(100),
  shopLogo: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  banner: z.string().optional(),
  description: z.string().nullable().optional(),
  businessHours: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  deliveryRange: z.number().optional(),
  deliveryFee: z.number().optional(),
  minOrderAmount: z.number().optional(),
  deliveryEnabled: z.boolean().optional(),
  pickupEnabled: z.boolean().optional(),
  estimatedTime: z.string().nullable().optional(),
  announcement: z.string().nullable().optional(),
  status: z.enum(["OPEN", "CLOSED", "RESTING"]).optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  sortNo: z.number().int().default(0),
  icon: z.string().optional(),
  parentId: z.number().int().nullable().optional(),
  status: z.enum(["ON", "OFF"]).optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  sortNo: z.number().int().optional(),
  icon: z.string().optional(),
  parentId: z.number().int().nullable().optional(),
  status: z.enum(["ON", "OFF"]).optional(),
});

const addRetailProductSchema = z.object({
  skuId: z.number().int().positive(),
  retailPrice: z.number().positive(),
  stock: z.number().int().min(0),
  isRecommended: z.boolean().optional(),
  isHot: z.boolean().optional(),
  isNew: z.boolean().optional(),
  sortNo: z.number().int().default(0),
});

const updateRetailProductSchema = z.object({
  retailPrice: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  isRecommended: z.boolean().optional(),
  isHot: z.boolean().optional(),
  isNew: z.boolean().optional(),
  sortNo: z.number().int().optional(),
  status: z.enum(["ON", "OFF"]).optional(),
});

const createBannerSchema = z.object({
  title: z.string().min(1).max(100),
  imageUrl: z.string().url().or(z.string().min(1)),
  linkUrl: z.string().nullable().optional(),
  linkType: z.string().optional(),
  sortNo: z.number().int().default(0),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

const updateBannerSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  imageUrl: z.string().url().or(z.string().min(1)).optional(),
  linkUrl: z.string().nullable().optional(),
  linkType: z.string().optional(),
  sortNo: z.number().int().optional(),
  status: z.enum(["ON", "OFF"]).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

const updateRetailOrderStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "PREPARING", "DELIVERING", "COMPLETED", "CANCELLED"]),
  reason: z.string().max(500).optional(),
});

const syncBodySchema = z.object({
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

const startDeliverySchema = z.object({
  deliveryCompany: z.string().optional(),
  deliveryNo: z.string().optional(),
  deliveryMan: z.string().optional(),
  deliveryPhone: z.string().optional(),
});

const cancelOrderSchema = z.object({
  reason: z.string().min(1).max(500),
});

// ────────────────────────────────────────────────────────────────────────────
// Webhook 端点
// ────────────────────────────────────────────────────────────────────────────

export const handleJdWebhook = asyncHandler(async (req, res) => {
  const { rawBody, signature, timestamp } = extractWebhookParams(req);
  const result = await instantRetailService.handleWebhook("JD", rawBody, signature, timestamp);
  res.status(result.status).json(result.response);
});

export const handleMeituanWebhook = asyncHandler(async (req, res) => {
  const { rawBody, signature, timestamp } = extractWebhookParams(req);
  const result = await instantRetailService.handleWebhook("MEITUAN", rawBody, signature, timestamp);
  res.status(result.status).json(result.response);
});

export const handleElemeWebhook = asyncHandler(async (req, res) => {
  const { rawBody, signature, timestamp } = extractWebhookParams(req);
  const result = await instantRetailService.handleWebhook("ELEME", rawBody, signature, timestamp);
  res.status(result.status).json(result.response);
});

// ────────────────────────────────────────────────────────────────────────────
// 工作台端点
// ────────────────────────────────────────────────────────────────────────────

export const getPlatforms = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await instantRetailService.getPlatforms(tenantId);
  res.json(ok(result));
});

export const getConfigs = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await instantRetailService.getConfigs(tenantId);
  res.json(ok(result));
});

export const getConfigByPlatform = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await instantRetailService.getConfigByPlatform(req.params.platform, tenantId);
  if (!result) {
    res.status(404).json(fail("平台配置不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const upsertConfig = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = upsertConfigSchema.parse(req.body);
  const result = await instantRetailService.upsertConfig(body, tenantId);
  res.json(ok(result));
});

export const testConnection = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await instantRetailService.testConnection(req.params.platform, tenantId);
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
  const result = await instantRetailService.syncOrders(req.params.platform, body, tenantId);
  if (!result.found) {
    res.status(404).json(fail("平台配置不存在", "404"));
    return;
  }
  res.json(ok({ platform: result.platform, synced: result.synced, hasMore: result.hasMore }));
});

export const syncProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = syncBodySchema.parse(req.body);
  const result = await instantRetailService.syncProducts(req.params.platform, body, tenantId);
  if (!result.found) {
    res.status(404).json(fail("平台配置不存在", "404"));
    return;
  }
  res.json(ok({ platform: result.platform, synced: result.synced, hasMore: result.hasMore }));
});

export const deleteConfig = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await instantRetailService.deleteConfig(req.params.platform, tenantId);
  res.json(ok(result));
});

// ────────────────────────────────────────────────────────────────────────────
// 门店端订单查询
// ────────────────────────────────────────────────────────────────────────────

export const listOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const { page, pageSize } = getPagination(req);
  const storeId = req.user?.storeId ? String(req.user.storeId) : null;
  const platform = req.query.platform ? String(req.query.platform) : null;
  const result = await instantRetailService.listOrders(page, pageSize, storeId, platform, tenantId);
  res.json(ok(result));
});

export const getOrderDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await instantRetailService.getOrderDetail(req.params.platformOrderId, tenantId);
  if (!result) {
    res.status(404).json(fail("订单不存在", "404"));
    return;
  }
  res.json(ok(result));
});

// ────────────────────────────────────────────────────────────────────────────
// 门店端订单操作
// ────────────────────────────────────────────────────────────────────────────

export const confirmOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await instantRetailService.confirmOrder(req.params.platformOrderId, tenantId);
  if (!result.found) {
    res.status(404).json(fail("订单不存在", "404"));
    return;
  }
  if (!result.configFound) {
    res.status(404).json(fail("平台配置不存在", "404"));
    return;
  }
  res.json(ok({ platformOrderId: result.platformOrderId, success: result.success, status: result.status }));
});

export const startDelivery = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = startDeliverySchema.parse(req.body);
  const result = await instantRetailService.startDelivery(req.params.platformOrderId, body, tenantId);
  if (!result.found) {
    res.status(404).json(fail("订单不存在", "404"));
    return;
  }
  if (!result.configFound) {
    res.status(404).json(fail("平台配置不存在", "404"));
    return;
  }
  res.json(ok({ platformOrderId: result.platformOrderId, success: result.success, status: result.status }));
});

export const completeDelivery = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await instantRetailService.completeDelivery(req.params.platformOrderId, tenantId);
  if (!result.found) {
    res.status(404).json(fail("订单不存在", "404"));
    return;
  }
  if (!result.configFound) {
    res.status(404).json(fail("平台配置不存在", "404"));
    return;
  }
  res.json(ok({ platformOrderId: result.platformOrderId, success: result.success, status: result.status }));
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = cancelOrderSchema.parse(req.body);
  const result = await instantRetailService.cancelOrder(
    req.params.platformOrderId,
    body.reason,
    tenantId
  );
  if (!result.found) {
    res.status(404).json(fail("订单不存在", "404"));
    return;
  }
  if (!result.configFound) {
    res.status(404).json(fail("平台配置不存在", "404"));
    return;
  }
  res.json(ok({ platformOrderId: result.platformOrderId, success: result.success, status: result.status }));
});

// ────────────────────────────────────────────────────────────────────────────
// 零售门店管理端点 (Phase 11)
// ────────────────────────────────────────────────────────────────────────────

export const getShopConfig = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = getStoreIdFromQuery(req);
  const result = await retailShopSvc.getShopConfig(storeId, tenantId);
  res.json(ok(result));
});

export const saveShopConfig = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = getStoreIdFromQuery(req);
  const body = saveShopConfigSchema.parse(req.body);
  const result = await retailShopSvc.saveShopConfig(storeId, body as any, tenantId);
  res.json(ok(result));
});

export const listCategories = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = getStoreIdFromQuery(req);
  const result = await retailShopSvc.listCategories(storeId, tenantId);
  res.json(ok(result));
});

export const createCategory = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = getStoreIdFromQuery(req);
  const body = createCategorySchema.parse(req.body);
  const result = await retailShopSvc.createCategory(storeId, body as any, tenantId);
  res.json(ok(result));
});

export const updateCategory = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = updateCategorySchema.parse(req.body);
  const result = await retailShopSvc.updateCategory(Number(req.params.id), body as any, tenantId);
  res.json(ok(result));
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  await retailShopSvc.deleteCategory(Number(req.params.id), tenantId);
  res.json(ok({ deleted: true }));
});

export const listRetailProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const { page, pageSize } = getPagination(req);
  const storeId = getStoreIdFromQuery(req);
  const result = await retailShopSvc.listRetailProducts({ storeId, tenantId, page, pageSize });
  res.json(ok(result));
});

export const addRetailProduct = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = getStoreIdFromQuery(req);
  const body = addRetailProductSchema.parse(req.body);
  const result = await retailShopSvc.addRetailProduct(storeId, body as any, tenantId);
  res.json(ok(result));
});

export const updateRetailProduct = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = updateRetailProductSchema.parse(req.body);
  const result = await retailShopSvc.updateRetailProduct(Number(req.params.id), body as any, tenantId);
  res.json(ok(result));
});

export const deleteRetailProduct = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  await retailShopSvc.deleteRetailProduct(Number(req.params.id), tenantId);
  res.json(ok({ deleted: true }));
});

export const listRetailOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const { page, pageSize } = getPagination(req);
  const storeId = getStoreIdFromQuery(req);
  const result = await retailShopSvc.listRetailOrders({
    storeId,
    tenantId,
    page,
    pageSize,
    status: String(req.query.orderStatus || ""),
    paymentStatus: String(req.query.paymentStatus || ""),
    platform: String(req.query.platform || ""),
    keyword: String(req.query.keyword || ""),
    startDate: String(req.query.startDate || ""),
    endDate: String(req.query.endDate || ""),
  });
  res.json(ok(result));
});

export const getRetailOrderDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await retailShopSvc.getRetailOrderDetail(req.params.orderNo, tenantId);
  if (!result) { res.status(404).json(fail("订单不存在", "404")); return; }
  res.json(ok(result));
});

export const updateRetailOrderStatus = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = updateRetailOrderStatusSchema.parse(req.body);
  const result = await retailShopSvc.updateRetailOrderStatus(req.params.orderNo, body.status, body.reason, tenantId);
  res.json(ok(result));
});

export const listBanners = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = getStoreIdFromQuery(req);
  const result = await retailShopSvc.listBanners(storeId, tenantId);
  res.json(ok(result));
});

export const createBanner = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = getStoreIdFromQuery(req);
  const body = createBannerSchema.parse(req.body);
  const result = await retailShopSvc.createBanner(storeId, body as any, tenantId);
  res.json(ok(result));
});

export const updateBanner = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = updateBannerSchema.parse(req.body);
  const result = await retailShopSvc.updateBanner(Number(req.params.id), body as any, tenantId);
  res.json(ok(result));
});

export const deleteBanner = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  await retailShopSvc.deleteBanner(Number(req.params.id), tenantId);
  res.json(ok({ deleted: true }));
});
