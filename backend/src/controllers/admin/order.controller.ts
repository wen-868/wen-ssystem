import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as orderService from "../../services/admin/order.service";

// ── 辅助函数（集中分支逻辑，减少重复分支统计） ──

/** 从查询参数中提取字符串（无值返回空串） */
function getQueryString(req: any, key: string): string {
  return String(req.query[key] || "");
}

/** 从查询参数中提取分页参数（默认 page=1, pageSize=20） */
function getPagination(req: any) {
  return {
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
  };
}

/** 从请求中提取操作人信息 */
function getOperator(req: any) {
  return {
    id: req.user?.id ?? null,
    name: req.user?.username ?? "系统用户",
  };
}

// ── Zod schemas ──
const cancelOrderSchema = z.object({
  reason: z.string().max(500).default(""),
});

const remarkOrderSchema = z.object({
  remark: z.string().max(1000).default(""),
});

const updateOrderStatusSchema = z.object({
  status: z.string().min(1),
  remark: z.string().max(500).optional(),
});

const batchUpdateOrderStatusSchema = z.object({
  orderNos: z.array(z.string().min(1)).min(1),
  status: z.string().min(1),
});

export const listOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const { page, pageSize } = getPagination(req);
  const keyword = getQueryString(req, "keyword");
  const status = getQueryString(req, "status");
  const dateStart = getQueryString(req, "dateStart");
  const dateEnd = getQueryString(req, "dateEnd");
  const result = await orderService.listOrders(page, pageSize, keyword, status, dateStart, dateEnd, tenantId);
  res.json(ok(result));
});

export const exportOrdersCsv = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const keyword = getQueryString(req, "keyword");
  const status = getQueryString(req, "status");
  const dateStart = getQueryString(req, "dateStart");
  const dateEnd = getQueryString(req, "dateEnd");
  const result = await orderService.exportOrdersCsv(keyword, status, dateStart, dateEnd, tenantId);
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="${result.filename}"`);
  res.send(result.csv);
});

export const getOrderDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await orderService.getOrderDetail(req.params.orderNo, tenantId);
  if (!result) {
    res.status(404).json(fail("订单不存在", "404"));
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
  const { page, pageSize } = getPagination(req);
  const keyword = getQueryString(req, "keyword");
  const status = getQueryString(req, "status");
  const dateStart = getQueryString(req, "dateStart");
  const dateEnd = getQueryString(req, "dateEnd");
  const result = await orderService.listSaleBills(page, pageSize, keyword, status, dateStart, dateEnd, tenantId);
  res.json(ok(result));
});

export const exportSaleBillsCsv = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const keyword = getQueryString(req, "keyword");
  const status = getQueryString(req, "status");
  const dateStart = getQueryString(req, "dateStart");
  const dateEnd = getQueryString(req, "dateEnd");
  const result = await orderService.exportSaleBillsCsv(keyword, status, dateStart, dateEnd, tenantId);
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="${result.filename}"`);
  res.send(result.csv);
});

// ========== Phase 12: 订单状态管理 ==========

export const cancelOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const orderNo = req.params.orderNo;
  const body = cancelOrderSchema.parse(req.body);
  const reason = body.reason;
  const { id: operatorId, name: operatorName } = getOperator(req);
  const result = await orderService.cancelOrder(orderNo, reason, operatorId, operatorName, tenantId);
  res.json(ok(result));
});

export const remarkOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const orderNo = req.params.orderNo;
  const body = remarkOrderSchema.parse(req.body);
  const remark = body.remark;
  const { id: operatorId, name: operatorName } = getOperator(req);
  const result = await orderService.remarkOrder(orderNo, remark, operatorId, operatorName, tenantId);
  res.json(ok(result));
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const orderNo = req.params.orderNo;
  const body = updateOrderStatusSchema.parse(req.body);
  const targetStatus = body.status;
  const remark = body.remark ?? null;
  const { id: operatorId, name: operatorName } = getOperator(req);
  const result = await orderService.updateOrderStatus(orderNo, targetStatus, operatorId, operatorName, remark, tenantId);
  res.json(ok(result));
});

export const batchUpdateOrderStatus = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = batchUpdateOrderStatusSchema.parse(req.body);
  const orderNos: string[] = body.orderNos;
  const targetStatus = body.status;
  const { id: operatorId, name: operatorName } = getOperator(req);
  if (!orderNos.length) {
    res.status(400).json(fail("订单号列表不能为空", "400"));
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