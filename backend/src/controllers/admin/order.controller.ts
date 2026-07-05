import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as orderService from "../../services/admin/order.service.js";
import { isProviderReady } from "../../services/admin/payment-config.service.js";

/**
 * 支付前置检查中间件：确保支付渠道已配置
 */
export const requirePaymentReady = asyncHandler(async (req: any, res: any, next: any) => {
  const provider = req.body.provider || req.query.provider || "wechat";
  const ready = await isProviderReady(req.tenantId!, provider);
  if (!ready) {
    res.status(400).json({
      code: "PAYMENT_NOT_CONFIGURED",
      message: "请先配置微信支付",
      provider: "wechat",
    });
    return;
  }
  next();
});

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

// ========== Phase 12: 订单状态管理 ==========

export const cancelOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const orderNo = req.params.orderNo;
  const reason = String(req.body.reason || "");
  const operatorId = (req as any).user?.id ?? null;
  const operatorName = (req as any).user?.username ?? "系统用户";
  const result = await orderService.cancelOrder(orderNo, reason, operatorId, operatorName, tenantId);
  res.json(ok(result));
});

export const remarkOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const orderNo = req.params.orderNo;
  const remark = String(req.body.remark || "");
  const operatorId = (req as any).user?.id ?? null;
  const operatorName = (req as any).user?.username ?? "系统用户";
  const result = await orderService.remarkOrder(orderNo, remark, operatorId, operatorName, tenantId);
  res.json(ok(result));
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const orderNo = req.params.orderNo;
  const targetStatus = String(req.body.status || "");
  const remark = req.body.remark ? String(req.body.remark) : null;
  const operatorId = (req as any).user?.id ?? null;
  const operatorName = (req as any).user?.username ?? "系统用户";
  const result = await orderService.updateOrderStatus(orderNo, targetStatus, operatorId, operatorName, remark, tenantId);
  res.json(ok(result));
});

export const batchUpdateOrderStatus = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const orderNos: string[] = req.body.orderNos || [];
  const targetStatus = String(req.body.status || "");
  const operatorId = (req as any).user?.id ?? null;
  const operatorName = (req as any).user?.username ?? "系统用户";
  if (!orderNos.length) {
    res.status(400).json({ code: "400", message: "订单号列表不能为空" });
    return;
  }
  const result = await orderService.batchUpdateOrderStatus(orderNos, targetStatus, operatorId, operatorName, tenantId);
  res.json(ok(result));
});

export const getOrderOperationLogs = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const orderNo = req.params.orderNo;
  const result = await orderService.getOrderOperationLogs(orderNo, tenantId);
  res.json(ok(result));
});