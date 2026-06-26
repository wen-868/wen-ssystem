import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as orderService from "../../services/admin/order.service.js";

export const listOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const keyword = String(req.query.keyword || "");
  const status = String(req.query.status || "");
  const dateStart = String(req.query.dateStart || "");
  const dateEnd = String(req.query.dateEnd || "");
  const result = await orderService.listOrders(page, pageSize, keyword, status, dateStart, dateEnd, tenantId);
  res.json(ok(result));
});

export const exportOrdersCsv = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const keyword = String(req.query.keyword || "");
  const status = String(req.query.status || "");
  const dateStart = String(req.query.dateStart || "");
  const dateEnd = String(req.query.dateEnd || "");
  const result = await orderService.exportOrdersCsv(keyword, status, dateStart, dateEnd, tenantId);
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="${result.filename}"`);
  res.send(result.csv);
});

export const getOrderDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await orderService.getOrderDetail(req.params.orderNo, tenantId);
  if (!result) {
    res.status(404).json({ code: "404", message: "订单不存在" });
    return;
  }
  res.json(ok(result));
});

export const getOrderStatusStats = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await orderService.getOrderStatusStats(tenantId);
  res.json(ok(result));
});

export const listSaleBills = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const keyword = String(req.query.keyword || "");
  const status = String(req.query.status || "");
  const dateStart = String(req.query.dateStart || "");
  const dateEnd = String(req.query.dateEnd || "");
  const result = await orderService.listSaleBills(page, pageSize, keyword, status, dateStart, dateEnd, tenantId);
  res.json(ok(result));
});

export const exportSaleBillsCsv = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const keyword = String(req.query.keyword || "");
  const status = String(req.query.status || "");
  const dateStart = String(req.query.dateStart || "");
  const dateEnd = String(req.query.dateEnd || "");
  const result = await orderService.exportSaleBillsCsv(keyword, status, dateStart, dateEnd, tenantId);
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="${result.filename}"`);
  res.send(result.csv);
});