import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { ok, fail } from "../shared/response.js";
import * as service from "../services/admin/aftersale.service.js";

// ── Zod schemas ──
const createAftersaleSchema = z.object({
  orderNo: z.string().min(1),
  aftersaleType: z.enum(["REFUND_ONLY", "RETURN_REFUND", "EXCHANGE", "REPAIR"]),
  reason: z.string().min(1).max(500),
  refundAmount: z.number().min(0).optional(),
  description: z.string().max(2000).optional(),
  images: z.array(z.string()).optional(),
  items: z.array(z.object({
    skuId: z.number().int().positive(),
    quantity: z.number().int().min(1),
    reason: z.string().optional(),
  })).optional(),
});

const submitReturnLogisticsSchema = z.object({
  logisticsCompany: z.string().min(1),
  logisticsNo: z.string().min(1),
  logisticsPhone: z.string().optional(),
  remark: z.string().max(500).optional(),
});

const rateAftersaleSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

const approveRejectAftersaleSchema = z.object({
  processRemark: z.string().max(500).optional(),
  version: z.number().int().positive().optional(),
});

const inspectAftersaleSchema = z.object({
  inspectResult: z.enum(["PASS", "FAIL"]),
  inspectRemark: z.string().max(500).optional(),
  inspectImages: z.array(z.string()).optional(),
  refundAmount: z.number().min(0).optional(),
});

const completeAftersaleSchema = z.object({
  completeRemark: z.string().max(500).optional(),
});

// ==================== 标签常量 ====================
export const AFTERSALE_TYPE_LABELS: Record<string, string> = {
  REFUND_ONLY: "仅退款",
  RETURN_REFUND: "退货退款",
  EXCHANGE: "换货",
  REPAIR: "维修"
};

export const AFTERSALE_STATUS_LABELS: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
  RETURNING: "退货中",
  RECEIVED: "已收货",
  INSPECTING: "验货中",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  EXPIRED: "已过期",
  CLOSED: "已关闭"
};

// ==================== 小程序端 ====================

export const miniappCreateAftersale = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = Number(req.user!.id || req.headers["x-customer-id"] || 1);
  const body = createAftersaleSchema.parse(req.body);
  const result = await service.createAftersale({
    tenantId,
    customerId,
    ...body,
    items: body.items ?? [],
    refundAmount: body.refundAmount ?? 0,
  } as any);
  res.json(ok(result));
});

export const miniappListMyAftersales = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = Number(req.user!.id || req.headers["x-customer-id"] || 1);
  const result = await service.listMyAftersales({
    tenantId,
    customerId,
    status: String(req.query.status || ""),
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
  });
  const list = result.records.map((row: any) => ({
    ...row,
    aftersaleTypeLabel: AFTERSALE_TYPE_LABELS[row.aftersaleType] || row.aftersaleType,
    statusLabel: AFTERSALE_STATUS_LABELS[row.status] || row.status,
    refundAmount: Number(row.refundAmount)
  }));
  res.json(ok({ ...result, records: list }));
});

export const miniappGetAftersaleDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = Number(req.user!.id || req.headers["x-customer-id"] || 1);
  const row = await service.getAftersaleDetail(req.params.aftersaleNo, customerId, tenantId);
  res.json(ok({
    ...row,
    items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
    images: typeof row.images === "string" ? JSON.parse(row.images) : row.images,
    inspectImages: typeof row.inspect_images === "string" ? JSON.parse(row.inspect_images) : row.inspect_images,
    aftersaleTypeLabel: AFTERSALE_TYPE_LABELS[row.aftersale_type] || row.aftersale_type,
    statusLabel: AFTERSALE_STATUS_LABELS[row.status] || row.status,
    refundAmount: Number(row.refund_amount)
  }));
});

export const miniappCancelAftersale = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = Number(req.user!.id || req.headers["x-customer-id"] || 1);
  const result = await service.cancelAftersale(req.params.aftersaleNo, customerId, tenantId);
  res.json(ok(result));
});

export const miniappSubmitReturnLogistics = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = Number(req.user!.id || req.headers["x-customer-id"] || 1);
  const body = submitReturnLogisticsSchema.parse(req.body);
  const result = await service.submitReturnLogistics({
    aftersaleNo: req.params.aftersaleNo,
    customerId,
    tenantId,
    returnLogisticsCompany: body.logisticsCompany,
    returnLogisticsNo: body.logisticsNo,
  } as any);
  res.json(ok(result));
});

export const miniappRateAftersale = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = Number(req.user!.id || req.headers["x-customer-id"] || 1);
  const body = rateAftersaleSchema.parse(req.body);
  const result = await service.rateAftersale({
    aftersaleNo: req.params.aftersaleNo,
    customerId,
    tenantId,
    satisfaction: body.rating,
    customerComment: body.comment,
  } as any);
  res.json(ok(result));
});

// ==================== 管理端 ====================

export const adminListAftersales = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await service.listAftersales({
    tenantId,
    status: String(req.query.status || ""),
    storeId: req.query.storeId ? Number(req.query.storeId) : undefined,
    startDate: String(req.query.startDate || ""),
    endDate: String(req.query.endDate || ""),
    keyword: String(req.query.keyword || ""),
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
  });
  const list = result.records.map((row: any) => ({
    ...row,
    aftersaleTypeLabel: AFTERSALE_TYPE_LABELS[row.aftersaleType] || row.aftersaleType,
    statusLabel: AFTERSALE_STATUS_LABELS[row.status] || row.status,
    refundAmount: Number(row.refund_amount)
  }));
  res.json(ok({ ...result, records: list }));
});

export const adminGetAftersaleDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const row = await service.getAftersaleDetailById(Number(req.params.id), tenantId);
  res.json(ok({
    ...row,
    items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
    images: typeof row.images === "string" ? JSON.parse(row.images) : row.images,
    inspectImages: typeof row.inspect_images === "string" ? JSON.parse(row.inspect_images) : row.inspect_images,
    aftersaleTypeLabel: AFTERSALE_TYPE_LABELS[row.aftersale_type] || row.aftersale_type,
    statusLabel: AFTERSALE_STATUS_LABELS[row.status] || row.status,
    refundAmount: Number(row.refund_amount)
  }));
});

export const adminApproveAftersale = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const operatorId = req.user!.id;
  const body = approveRejectAftersaleSchema.parse(req.body);
  const result = await service.approveAftersale(
    Number(req.params.id), tenantId, operatorId, body.processRemark ?? "", body.version
  );
  res.json(ok(result));
});

export const adminRejectAftersale = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const operatorId = req.user!.id;
  const body = approveRejectAftersaleSchema.parse(req.body);
  const result = await service.rejectAftersale(
    Number(req.params.id), tenantId, operatorId, body.processRemark ?? "", body.version
  );
  res.json(ok(result));
});

export const adminConfirmReceipt = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await service.confirmReceipt(Number(req.params.id), tenantId);
  res.json(ok(result));
});

export const adminInspectAftersale = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const operatorId = req.user!.id;
  const body = inspectAftersaleSchema.parse(req.body);
  const result = await service.inspectAftersale({
    id: Number(req.params.id),
    tenantId,
    operatorId,
    ...body
  });
  res.json(ok(result));
});

export const adminCompleteAftersale = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const operatorId = req.user!.id;
  const body = completeAftersaleSchema.parse(req.body);
  const result = await service.completeAftersale({
    id: Number(req.params.id),
    tenantId,
    operatorId,
    ...body
  });
  res.json(ok(result));
});

export const adminGetStatistics = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = req.query.storeId ? Number(req.query.storeId) : undefined;
  const result = await service.getAftersaleStatistics(tenantId, storeId);
  res.json(ok({
    typeStats: result.typeStats.map((r: any) => ({ type: r.type, typeLabel: AFTERSALE_TYPE_LABELS[r.type] || r.type, count: r.count })),
    statusStats: result.statusStats.map((r: any) => ({ status: r.status, statusLabel: AFTERSALE_STATUS_LABELS[r.status] || r.status, count: r.count })),
    avgProcessingHours: result.avgProcessingHours,
    avgSatisfaction: result.avgSatisfaction,
    overdueRate: result.overdueRate
  }));
});