/**
 * 即时零售 Controller 层
 * 只做参数提取和响应封装，业务逻辑委托给 Service
 */

import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as instantRetailService from "../../services/admin/instant-retail.service.js";

// ────────────────────────────────────────────────────────────────────────────
// Webhook 端点
// ────────────────────────────────────────────────────────────────────────────

export const handleJdWebhook = asyncHandler(async (req, res) => {
  const rawBody = req.body ?? {};
  const signature = String(req.headers["x-signature"] ?? req.headers["signature"] ?? req.query.sign ?? "");
  const timestamp = String(req.headers["x-timestamp"] ?? req.query.timestamp ?? "");
  const result = await instantRetailService.handleWebhook("JD", rawBody, signature, timestamp);
  res.status(result.status).json(result.response);
});

export const handleMeituanWebhook = asyncHandler(async (req, res) => {
  const rawBody = req.body ?? {};
  const signature = String(req.headers["x-signature"] ?? req.headers["signature"] ?? req.query.sign ?? "");
  const timestamp = String(req.headers["x-timestamp"] ?? req.query.timestamp ?? "");
  const result = await instantRetailService.handleWebhook("MEITUAN", rawBody, signature, timestamp);
  res.status(result.status).json(result.response);
});

export const handleElemeWebhook = asyncHandler(async (req, res) => {
  const rawBody = req.body ?? {};
  const signature = String(req.headers["x-signature"] ?? req.headers["signature"] ?? req.query.sign ?? "");
  const timestamp = String(req.headers["x-timestamp"] ?? req.query.timestamp ?? "");
  const result = await instantRetailService.handleWebhook("ELEME", rawBody, signature, timestamp);
  res.status(result.status).json(result.response);
});

// ────────────────────────────────────────────────────────────────────────────
// 管理后台端点
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
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  res.json(ok(result));
});

export const upsertConfig = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await instantRetailService.upsertConfig(req.body, tenantId);
  res.json(ok(result));
});

export const testConnection = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await instantRetailService.testConnection(req.params.platform, tenantId);
  if (!result.found) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  if (!result.connected) {
    res.status(502).json({ code: "502", message: `连接失败: ${result.error}` });
    return;
  }
  res.json(ok({ platform: result.platform, connected: true, tokenUpdated: result.tokenUpdated }));
});

export const syncOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await instantRetailService.syncOrders(req.params.platform, req.body, tenantId);
  if (!result.found) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  res.json(ok({ platform: result.platform, synced: result.synced, hasMore: result.hasMore }));
});

export const syncProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await instantRetailService.syncProducts(req.params.platform, req.body, tenantId);
  if (!result.found) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
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
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const storeId = req.user?.storeId ? String(req.user.storeId) : null;
  const platform = req.query.platform ? String(req.query.platform) : null;
  const result = await instantRetailService.listOrders(page, pageSize, storeId, platform, tenantId);
  res.json(ok(result));
});

export const getOrderDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await instantRetailService.getOrderDetail(req.params.platformOrderId, tenantId);
  if (!result) {
    res.status(404).json({ code: "404", message: "订单不存在" });
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
    res.status(404).json({ code: "404", message: "订单不存在" });
    return;
  }
  if (!result.configFound) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  res.json(ok({ platformOrderId: result.platformOrderId, success: result.success, status: result.status }));
});

export const startDelivery = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await instantRetailService.startDelivery(req.params.platformOrderId, req.body, tenantId);
  if (!result.found) {
    res.status(404).json({ code: "404", message: "订单不存在" });
    return;
  }
  if (!result.configFound) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  res.json(ok({ platformOrderId: result.platformOrderId, success: result.success, status: result.status }));
});

export const completeDelivery = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await instantRetailService.completeDelivery(req.params.platformOrderId, tenantId);
  if (!result.found) {
    res.status(404).json({ code: "404", message: "订单不存在" });
    return;
  }
  if (!result.configFound) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  res.json(ok({ platformOrderId: result.platformOrderId, success: result.success, status: result.status }));
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await instantRetailService.cancelOrder(
    req.params.platformOrderId,
    req.body.reason,
    tenantId
  );
  if (!result.found) {
    res.status(404).json({ code: "404", message: "订单不存在" });
    return;
  }
  if (!result.configFound) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  res.json(ok({ platformOrderId: result.platformOrderId, success: result.success, status: result.status }));
});