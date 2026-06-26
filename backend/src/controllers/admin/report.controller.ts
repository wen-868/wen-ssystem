import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as reportService from "../../services/admin/report.service.js";

export const getDashboard = asyncHandler(async (req, res) => {
  const result = await reportService.getDashboard(req.tenantId!);
  res.json(ok(result));
});

export const getDailySalesTrend = asyncHandler(async (req, res) => {
  const result = await reportService.getDailySalesTrend(req.tenantId!);
  res.json(ok(result));
});

export const getStoreSalesPerformance = asyncHandler(async (req, res) => {
  const result = await reportService.getStoreSalesPerformance(req.tenantId!);
  res.json(ok(result));
});

export const getInventoryAlerts = asyncHandler(async (req, res) => {
  const result = await reportService.getInventoryAlerts(req.tenantId!);
  res.json(ok(result));
});

export const listInventoryBalance = asyncHandler(async (req, res) => {
  const result = await reportService.listInventoryBalance(
    req.tenantId!,
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20),
    String(req.query.keyword || ""),
    req.query.storeId ? Number(req.query.storeId) : undefined,
    req.query.category ? Number(req.query.category) : undefined
  );
  res.json(ok(result));
});

export const listInventoryLogs = asyncHandler(async (req, res) => {
  const result = await reportService.listInventoryLogs(
    req.tenantId!,
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
  res.json(ok(result));
});

export const listCollectionLinks = asyncHandler(async (req, res) => {
  const result = await reportService.listCollectionLinks(
    req.tenantId!,
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
  res.json(ok(result));
});

export const listPaymentOrders = asyncHandler(async (req, res) => {
  const result = await reportService.listPaymentOrders(
    req.tenantId!,
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
  res.json(ok(result));
});

export const listRefundOrders = asyncHandler(async (req, res) => {
  const result = await reportService.listRefundOrders(
    req.tenantId!,
    Number(req.query.page || 1),
    Number(req.query.pageSize || 20)
  );
  res.json(ok(result));
});