import { asyncHandler } from "../middleware/async-handler";
import { ok } from "../shared/response";
import * as service from "../services/admin/dashboard.service";

export const getOverview = asyncHandler(async (req, res) => {
  const result = await service.getOverview(req.tenantId!);
  res.json(ok(result));
});

export const getSalesTrend = asyncHandler(async (req, res) => {
  const result = await service.getSalesTrend(req.tenantId!);
  res.json(ok(result));
});

export const getCategoryPie = asyncHandler(async (req, res) => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  const dateStart = String(req.query.dateStart || d.toISOString().slice(0, 10));
  const dateEnd = String(req.query.dateEnd || new Date().toISOString().slice(0, 10));
  const result = await service.getCategoryPie(req.tenantId!, dateStart, dateEnd);
  res.json(ok(result));
});

export const getTopProducts = asyncHandler(async (req, res) => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  const dateStart = String(req.query.dateStart || d.toISOString().slice(0, 10));
  const dateEnd = String(req.query.dateEnd || new Date().toISOString().slice(0, 10));
  const result = await service.getTopProducts(req.tenantId!, dateStart, dateEnd);
  res.json(ok(result));
});

export const getTopCustomers = asyncHandler(async (req, res) => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  const dateStart = String(req.query.dateStart || d.toISOString().slice(0, 10));
  const dateEnd = String(req.query.dateEnd || new Date().toISOString().slice(0, 10));
  const result = await service.getTopCustomers(req.tenantId!, dateStart, dateEnd);
  res.json(ok(result));
});

export const getRecentAlerts = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 10), 50);
  const result = await service.getRecentAlerts(req.tenantId!, limit);
  res.json(ok(result));
});

// ========== Phase 14: 工作台增强 ==========

export const getTodos = asyncHandler(async (req, res) => {
  const result = await service.getTodos(req.tenantId!);
  res.json(ok(result));
});

export const getRecentOrders = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 5), 20);
  const result = await service.getRecentOrders(req.tenantId!, limit);
  res.json(ok(result));
});

export const getSalesTrendByDay = asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days || 7), 90);
  const result = await service.getSalesTrendByDay(req.tenantId!, days);
  res.json(ok(result));
});