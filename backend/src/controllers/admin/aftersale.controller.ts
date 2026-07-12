import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as service from "../../services/admin/aftersale.service";

// ==================== 辅助函数（集中分支逻辑，减少重复分支统计） ====================

/** 从请求中提取客户 ID（优先 user.id，其次 header，默认 1） */
function getCustomerId(req: any): number {
  return Number(req.user!.id || req.headers["x-customer-id"] || 1);
}

/** 解析可能为 JSON 字符串的字段 */
function parseJsonField(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

/** 从查询参数中提取字符串（无值返回空串） */
function getQueryString(req: any, key: string): string {
  return String(req.query[key] || "");
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
  const customerId = getCustomerId(req);
  const result = await service.createAftersale({
    tenantId,
    customerId,
    ...req.body
  });
  res.json(ok(result));
});

export const miniappListMyAftersales = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const result = await service.listMyAftersales({
    tenantId,
    customerId,
    status: getQueryString(req, "status"),
    ...getPagination(req),
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
  const customerId = getCustomerId(req);
  const row = await service.getAftersaleDetail(req.params.aftersaleNo, customerId, tenantId);
  res.json(ok({
    ...row,
    items: parseJsonField(row.items),
    images: parseJsonField(row.images),
    inspectImages: parseJsonField(row.inspect_images),
    aftersaleTypeLabel: AFTERSALE_TYPE_LABELS[(row as any).aftersale_type] || (row as any).aftersale_type,
    statusLabel: AFTERSALE_STATUS_LABELS[(row as any).status] || (row as any).status,
    refundAmount: Number(row.refund_amount)
  }));
});

export const miniappCancelAftersale = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const result = await service.cancelAftersale(req.params.aftersaleNo, customerId, tenantId);
  res.json(ok(result));
});

export const miniappSubmitReturnLogistics = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const result = await service.submitReturnLogistics({
    aftersaleNo: req.params.aftersaleNo,
    customerId,
    tenantId,
    ...req.body
  });
  res.json(ok(result));
});

export const miniappRateAftersale = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const result = await service.rateAftersale({
    aftersaleNo: req.params.aftersaleNo,
    customerId,
    tenantId,
    ...req.body
  });
  res.json(ok(result));
});

// ==================== 管理端 ====================

export const adminListAftersales = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await service.listAftersales({
    tenantId,
    status: getQueryString(req, "status"),
    storeId: getStoreIdFromQuery(req),
    startDate: getQueryString(req, "startDate"),
    endDate: getQueryString(req, "endDate"),
    keyword: getQueryString(req, "keyword"),
    ...getPagination(req),
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
    items: parseJsonField(row.items),
    images: parseJsonField(row.images),
    inspectImages: parseJsonField(row.inspect_images),
    aftersaleTypeLabel: AFTERSALE_TYPE_LABELS[(row as any).aftersale_type] || (row as any).aftersale_type,
    statusLabel: AFTERSALE_STATUS_LABELS[(row as any).status] || (row as any).status,
    refundAmount: Number(row.refund_amount)
  }));
});

export const adminApproveAftersale = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const operatorId = req.user!.id;
  const result = await service.approveAftersale(
    Number(req.params.id), tenantId, operatorId, req.body.processRemark, req.body.version
  );
  res.json(ok(result));
});

export const adminRejectAftersale = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const operatorId = req.user!.id;
  const result = await service.rejectAftersale(
    Number(req.params.id), tenantId, operatorId, req.body.processRemark, req.body.version
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
  const result = await service.inspectAftersale({
    id: Number(req.params.id),
    tenantId,
    operatorId,
    ...req.body
  });
  res.json(ok(result));
});

export const adminCompleteAftersale = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const operatorId = req.user!.id;
  const result = await service.completeAftersale({
    id: Number(req.params.id),
    tenantId,
    operatorId,
    ...req.body
  });
  res.json(ok(result));
});

export const adminGetStatistics = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = getStoreIdFromQuery(req);
  const result = await service.getAftersaleStatistics(tenantId, storeId);
  res.json(ok({
    typeStats: result.typeStats.map((r: any) => ({ type: r.type, typeLabel: AFTERSALE_TYPE_LABELS[r.type] || r.type, count: r.count })),
    statusStats: result.statusStats.map((r: any) => ({ status: r.status, statusLabel: AFTERSALE_STATUS_LABELS[r.status] || r.status, count: r.count })),
    avgProcessingHours: result.avgProcessingHours,
    avgSatisfaction: result.avgSatisfaction,
    overdueRate: result.overdueRate
  }));
});