/**
 * 即时零售管理扩展 Controller 层（ajian_retail_fix_01）
 *
 * 只做参数提取、校验与响应封装，业务逻辑委托给 retail-ops-ext.service。
 * 端点：
 *   - 货架 shelf：GET/POST /api/admin/instant-retail/shelf、PUT/DELETE /shelf/:id
 *   - 支付 payments：GET /api/admin/instant-retail/payments、GET /payments/:paymentNo
 *   - 配送 deliveries：GET /api/admin/instant-retail/deliveries、
 *     POST /deliveries/:deliveryId/assign、PUT /deliveries/:deliveryId/status
 *   - 接单看板 order-board：GET /api/admin/instant-retail/order-board
 *   - 购物车分析：GET /api/admin/retail-cart/analysis
 */

import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as retailOpsExtSvc from "../../services/instant-retail/retail-ops-ext.service";

/** 从查询参数中提取分页参数（默认 page=1, pageSize=20） */
function getPagination(req: any) {
  return {
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
  };
}

const listShelfQuerySchema = z.object({
  keyword: z.string().optional(),
  category: z.coerce.number().int().positive().optional(),
  status: z.enum(["ON", "OFF"]).optional(),
  tag: z.enum(["RECOMMEND", "HOT", "NEW"]).optional(),
});

const addShelfSchema = z.object({
  skuId: z.number().int().positive(),
  categoryId: z.number().int().positive().optional(),
  retailPrice: z.number().positive(),
  originalPrice: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  tags: z.array(z.enum(["RECOMMEND", "HOT", "NEW"])).optional(),
  sort: z.number().int().optional(),
  status: z.enum(["ON", "OFF"]).optional(),
});

const updateShelfSchema = z.object({
  categoryId: z.number().int().positive().nullable().optional(),
  retailPrice: z.number().positive().optional(),
  originalPrice: z.number().positive().nullable().optional(),
  stock: z.number().int().min(0).optional(),
  tags: z.array(z.enum(["RECOMMEND", "HOT", "NEW"])).optional(),
  sort: z.number().int().optional(),
  status: z.enum(["ON", "OFF"]).optional(),
});

const listPaymentsQuerySchema = z.object({
  orderNo: z.string().optional(),
  paymentMethod: z.string().optional(),
  status: z.enum(["UNPAID", "PAID", "REFUNDED"]).optional(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
});

const listDeliveriesQuerySchema = z.object({
  orderNo: z.string().optional(),
  deliveryStatus: z.string().optional(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
});

const assignDeliverySchema = z.object({
  riderId: z.number().int().positive(),
  riderName: z.string().min(1).max(64),
});

const updateDeliveryStatusSchema = z.object({
  status: z.enum(["PENDING", "ASSIGNED", "PICKING", "DELIVERING", "COMPLETED", "CANCELLED"]),
});

// ────────────────────────────────────────────────────────────
// 货架 shelf
// ────────────────────────────────────────────────────────────

export const listShelfProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const { page, pageSize } = getPagination(req);
  const query = listShelfQuerySchema.parse(req.query);
  const result = await retailOpsExtSvc.listShelfProducts({
    tenantId,
    keyword: query.keyword,
    category: query.category,
    status: query.status,
    tag: query.tag,
    page,
    pageSize,
  });
  res.json(ok(result));
});

export const addShelfProduct = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = addShelfSchema.parse(req.body);
  const result = await retailOpsExtSvc.addShelfProduct(body, tenantId);
  res.json(ok(result));
});

export const updateShelfProduct = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const body = updateShelfSchema.parse(req.body);
  const result = await retailOpsExtSvc.updateShelfProduct(id, body, tenantId);
  res.json(ok(result));
});

export const removeShelfProduct = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  await retailOpsExtSvc.removeShelfProduct(id, tenantId);
  res.json(ok({ deleted: true }));
});

// ────────────────────────────────────────────────────────────
// 在线支付 payments
// ────────────────────────────────────────────────────────────

export const listPayments = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const { page, pageSize } = getPagination(req);
  const query = listPaymentsQuerySchema.parse(req.query);
  const result = await retailOpsExtSvc.listPayments({
    tenantId,
    orderNo: query.orderNo,
    paymentMethod: query.paymentMethod,
    status: query.status,
    dateStart: query.dateStart,
    dateEnd: query.dateEnd,
    page,
    pageSize,
  });
  res.json(ok(result));
});

export const getPaymentDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const paymentNo = req.params.paymentNo;
  const result = await retailOpsExtSvc.getPaymentDetail(paymentNo, tenantId);
  if (!result) {
    res.status(404).json(fail("支付记录不存在", "404"));
    return;
  }
  res.json(ok(result));
});

// ────────────────────────────────────────────────────────────
// 配送管理 deliveries
// ────────────────────────────────────────────────────────────

export const listDeliveries = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const { page, pageSize } = getPagination(req);
  const query = listDeliveriesQuerySchema.parse(req.query);
  const result = await retailOpsExtSvc.listDeliveries({
    tenantId,
    orderNo: query.orderNo,
    deliveryStatus: query.deliveryStatus,
    dateStart: query.dateStart,
    dateEnd: query.dateEnd,
    page,
    pageSize,
  });
  res.json(ok(result));
});

export const assignDelivery = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const deliveryId = Number(req.params.deliveryId);
  const body = assignDeliverySchema.parse(req.body);
  const result = await retailOpsExtSvc.assignDeliveryRider(deliveryId, body, tenantId);
  res.json(ok(result));
});

export const updateDeliveryStatus = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const deliveryId = Number(req.params.deliveryId);
  const body = updateDeliveryStatusSchema.parse(req.body);
  const result = await retailOpsExtSvc.updateDeliveryStatus(deliveryId, body.status, tenantId);
  res.json(ok(result));
});

// ────────────────────────────────────────────────────────────
// 60 秒接单看板 order-board
// ────────────────────────────────────────────────────────────

export const getOrderBoard = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await retailOpsExtSvc.getOrderBoard(tenantId);
  res.json(ok(result));
});

// ────────────────────────────────────────────────────────────
// 购物车分析 retail-cart/analysis
// ────────────────────────────────────────────────────────────

export const getRetailCartAnalysis = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await retailOpsExtSvc.getRetailCartAnalysis(tenantId);
  res.json(ok(result));
});
