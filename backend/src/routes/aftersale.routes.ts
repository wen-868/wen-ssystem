import { Router } from "express";
import { z } from "zod";
import { requireAuthWithTenant } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok, fail } from "../shared/response.js";

// ========== 售后工单 - 小程序端路由 ==========
export const miniappAftersaleRouter = Router();

// ========== 售后工单 - 管理端路由 ==========
export const adminAftersaleRouter = Router();

// ---------- 售后类型映射 ----------
const AFTERSALE_TYPE_LABELS: Record<string, string> = {
  REFUND_ONLY: "仅退款",
  RETURN_REFUND: "退货退款",
  EXCHANGE: "换货",
  REPAIR: "维修"
};

const AFTERSALE_STATUS_LABELS: Record<string, string> = {
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

// POST /aftersales - 创建售后申请
miniappAftersaleRouter.post("/aftersales", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = Number(req.user!.id || req.headers["x-customer-id"] || 1);
  const body = z.object({
    orderNo: z.string().min(1),
    aftersaleType: z.enum(["REFUND_ONLY", "RETURN_REFUND", "EXCHANGE", "REPAIR"]),
    reason: z.string().min(1),
    reasonDetail: z.string().optional(),
    images: z.array(z.string().url()).optional(),
    items: z.array(z.object({
      skuId: z.number(),
      skuName: z.string(),
      qty: z.number().int().positive(),
      unitPrice: z.number(),
      subtotal: z.number()
    })).min(1),
    refundAmount: z.number().min(0).default(0),
    exchangeSkuId: z.number().optional(),
    exchangeQty: z.number().int().positive().optional()
  }).parse(req.body);

  // 校验订单存在且属于当前客户
  const order = await queryOne<any>(
    `SELECT id, order_no, store_id, member_id, order_status FROM miniapp_order WHERE order_no = ? AND member_id = ? AND tenant_id = ?`,
    [body.orderNo, customerId, tenantId]
  );
  if (!order) {
    res.status(404).json(fail("订单不存在"));
    return;
  }
  if (order.order_status === "CANCELLED") {
    res.status(400).json(fail("已取消的订单不可申请售后"));
    return;
  }

  // 校验是否已有进行中的售后
  const existingAftersale = await queryOne<any>(
    `SELECT id FROM aftersale WHERE order_no = ? AND customer_id = ? AND tenant_id = ? AND status NOT IN ('CANCELLED', 'COMPLETED', 'REJECTED', 'EXPIRED', 'CLOSED')`,
    [body.orderNo, customerId, tenantId]
  );
  if (existingAftersale) {
    res.status(400).json(fail("该订单已有进行中的售后申请"));
    return;
  }

  const aftersaleNo = makeBizNo("AS");
  const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48小时处理截止

  await query(
    `INSERT INTO aftersale (aftersale_no, order_id, order_no, customer_id, store_id, aftersale_type,
                              reason, reason_detail, images, items, refund_amount, exchange_sku_id, exchange_qty,
                              status, deadline, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
    [
      aftersaleNo, order.id, body.orderNo, customerId, order.store_id, body.aftersaleType,
      body.reason, body.reasonDetail ?? null, JSON.stringify(body.images || []), JSON.stringify(body.items),
      body.refundAmount, body.exchangeSkuId ?? null, body.exchangeQty ?? null, deadline, tenantId
    ]
  );

  res.json(ok({
    aftersaleNo,
    status: "PENDING",
    deadline: deadline.toISOString(),
    message: "售后申请已提交"
  }));
}));

// GET /aftersales/mine - 我的售后列表
miniappAftersaleRouter.get("/aftersales/mine", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = Number(req.user!.id || req.headers["x-customer-id"] || 1);
  const status = String(req.query.status || "");
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;

  let whereSql = "WHERE a.customer_id = ? AND a.tenant_id = ?";
  const params: any[] = [customerId, tenantId];
  if (status) {
    whereSql += " AND a.status = ?";
    params.push(status);
  }

  const records = await query<any>(
    `SELECT a.id, a.aftersale_no AS aftersaleNo, a.order_no AS orderNo, a.aftersale_type AS aftersaleType,
            a.reason, a.refund_amount AS refundAmount, a.status, a.deadline,
            a.return_logistics_no AS returnLogisticsNo,
            a.created_at AS createdAt, a.updated_at AS updatedAt
     FROM aftersale a ${whereSql}
     ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const total = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM aftersale a ${whereSql}`,
    params
  );

  const list = records.map((row: any) => ({
    ...row,
    aftersaleTypeLabel: AFTERSALE_TYPE_LABELS[row.aftersaleType] || row.aftersaleType,
    statusLabel: AFTERSALE_STATUS_LABELS[row.status] || row.status,
    refundAmount: Number(row.refundAmount)
  }));

  res.json(ok({ total: total?.total ?? 0, page, pageSize, records: list }));
}));

// GET /aftersales/:aftersaleNo - 售后详情
miniappAftersaleRouter.get("/aftersales/:aftersaleNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = Number(req.user!.id || req.headers["x-customer-id"] || 1);
  const row = await queryOne<any>(
    `SELECT a.*, o.receiver_name AS orderReceiverName, o.receiver_mobile AS orderReceiverMobile
     FROM aftersale a
     LEFT JOIN miniapp_order o ON o.order_no = a.order_no AND o.tenant_id = a.tenant_id
     WHERE a.aftersale_no = ? AND a.customer_id = ? AND a.tenant_id = ?`,
    [req.params.aftersaleNo, customerId, tenantId]
  );
  if (!row) {
    res.status(404).json(fail("售后单不存在"));
    return;
  }
  res.json(ok({
    ...row,
    items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
    images: typeof row.images === "string" ? JSON.parse(row.images) : row.images,
    inspectImages: typeof row.inspect_images === "string" ? JSON.parse(row.inspect_images) : row.inspect_images,
    aftersaleTypeLabel: AFTERSALE_TYPE_LABELS[row.aftersale_type] || row.aftersale_type,
    statusLabel: AFTERSALE_STATUS_LABELS[row.status] || row.status,
    refundAmount: Number(row.refund_amount)
  }));
}));

// POST /aftersales/:aftersaleNo/cancel - 取消售后
miniappAftersaleRouter.post("/aftersales/:aftersaleNo/cancel", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = Number(req.user!.id || req.headers["x-customer-id"] || 1);
  const result = await query(
    `UPDATE aftersale SET status = 'CANCELLED', updated_at = NOW()
     WHERE aftersale_no = ? AND customer_id = ? AND tenant_id = ? AND status = 'PENDING'`,
    [req.params.aftersaleNo, customerId, tenantId]
  );
  if ((result as any).affectedRows === 0) {
    res.status(400).json(fail("无法取消（非待审核状态或不属于您）"));
    return;
  }
  res.json(ok({ message: "售后已取消" }));
}));

// POST /aftersales/:aftersaleNo/return-logistics - 填写退货物流
miniappAftersaleRouter.post("/aftersales/:aftersaleNo/return-logistics", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = Number(req.user!.id || req.headers["x-customer-id"] || 1);
  const body = z.object({
    returnLogisticsNo: z.string().min(1),
    returnLogisticsCompany: z.string().min(1)
  }).parse(req.body);

  const result = await query(
    `UPDATE aftersale SET return_logistics_no = ?, return_logistics_company = ?, status = 'RETURNING', updated_at = NOW()
     WHERE aftersale_no = ? AND customer_id = ? AND tenant_id = ? AND status IN ('APPROVED', 'RETURNING')`,
    [body.returnLogisticsNo, body.returnLogisticsCompany, req.params.aftersaleNo, customerId, tenantId]
  );
  if ((result as any).affectedRows === 0) {
    res.status(400).json(fail("无法填写物流（状态不允许或不属于您）"));
    return;
  }
  res.json(ok({ message: "物流信息已填写" }));
}));

// POST /aftersales/:aftersaleNo/rate - 评价售后处理
miniappAftersaleRouter.post("/aftersales/:aftersaleNo/rate", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = Number(req.user!.id || req.headers["x-customer-id"] || 1);
  const body = z.object({
    satisfaction: z.number().int().min(1).max(5),
    customerComment: z.string().optional()
  }).parse(req.body);

  const result = await query(
    `UPDATE aftersale SET satisfaction = ?, customer_comment = ?, updated_at = NOW()
     WHERE aftersale_no = ? AND customer_id = ? AND tenant_id = ? AND status = 'COMPLETED'`,
    [body.satisfaction, body.customerComment ?? null, req.params.aftersaleNo, customerId, tenantId]
  );
  if ((result as any).affectedRows === 0) {
    res.status(400).json(fail("无法评价（仅已完成状态可评价）"));
    return;
  }
  res.json(ok({ message: "评价成功" }));
}));

// ==================== 管理端 ====================

// GET /aftersales - 售后列表（支持筛选+分页）
adminAftersaleRouter.get("/aftersales", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const status = String(req.query.status || "");
  const storeId = req.query.storeId ? Number(req.query.storeId) : null;
  const startDate = String(req.query.startDate || "");
  const endDate = String(req.query.endDate || "");
  const keyword = String(req.query.keyword || "");
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;

  const conditions: string[] = ["a.tenant_id = ?"];
  const params: any[] = [tenantId];

  if (status) { conditions.push("a.status = ?"); params.push(status); }
  if (storeId) { conditions.push("a.store_id = ?"); params.push(storeId); }
  if (startDate) { conditions.push("a.created_at >= ?"); params.push(startDate); }
  if (endDate) { conditions.push("a.created_at <= ?"); params.push(endDate + " 23:59:59"); }
  if (keyword) { conditions.push("(a.aftersale_no LIKE ? OR a.order_no LIKE ? OR a.reason LIKE ?)"); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }

  const whereSql = `WHERE ${conditions.join(" AND ")}`;

  const records = await query<any>(
    `SELECT a.id, a.aftersale_no AS aftersaleNo, a.order_no AS orderNo, a.customer_id AS customerId,
            a.store_id AS storeId, a.aftersale_type AS aftersaleType, a.reason, a.refund_amount AS refundAmount,
            a.status, a.deadline, a.return_logistics_no AS returnLogisticsNo,
            a.return_logistics_company AS returnLogisticsCompany,
            a.created_at AS createdAt, a.updated_at AS updatedAt
     FROM aftersale a ${whereSql}
     ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const total = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM aftersale a ${whereSql}`,
    params
  );

  const list = records.map((row: any) => ({
    ...row,
    aftersaleTypeLabel: AFTERSALE_TYPE_LABELS[row.aftersaleType] || row.aftersaleType,
    statusLabel: AFTERSALE_STATUS_LABELS[row.status] || row.status,
    refundAmount: Number(row.refund_amount)
  }));

  res.json(ok({ total: total?.total ?? 0, page, pageSize, records: list }));
}));

// GET /aftersales/:id - 售后详情（完整信息）
adminAftersaleRouter.get("/aftersales/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const row = await queryOne<any>(
    `SELECT a.*,
            o.receiver_name AS orderReceiverName, o.receiver_mobile AS orderReceiverMobile, o.receiver_address AS orderReceiverAddress
     FROM aftersale a
     LEFT JOIN miniapp_order o ON o.order_no = a.order_no AND o.tenant_id = a.tenant_id
     WHERE a.id = ? AND a.tenant_id = ?`,
    [req.params.id, tenantId]
  );
  if (!row) {
    res.status(404).json(fail("售后单不存在"));
    return;
  }
  res.json(ok({
    ...row,
    items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
    images: typeof row.images === "string" ? JSON.parse(row.images) : row.images,
    inspectImages: typeof row.inspect_images === "string" ? JSON.parse(row.inspect_images) : row.inspect_images,
    aftersaleTypeLabel: AFTERSALE_TYPE_LABELS[row.aftersale_type] || row.aftersale_type,
    statusLabel: AFTERSALE_STATUS_LABELS[row.status] || row.status,
    refundAmount: Number(row.refund_amount)
  }));
}));

// POST /aftersales/:id/approve - 审核通过
adminAftersaleRouter.post("/aftersales/:id/approve", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const operatorId = req.user!.id;
  const result = await query(
    `UPDATE aftersale SET status = 'APPROVED', processed_by = ?, process_remark = ?, updated_at = NOW(), version = version + 1
     WHERE id = ? AND tenant_id = ? AND status = 'PENDING' AND version = ?`,
    [operatorId, req.body.processRemark || null, req.params.id, tenantId, req.body.version || 1]
  );
  if ((result as any).affectedRows === 0) {
    res.status(400).json(fail("审核失败（状态已变更或版本不匹配）"));
    return;
  }
  res.json(ok({ message: "审核通过" }));
}));

// POST /aftersales/:id/reject - 审核拒绝
adminAftersaleRouter.post("/aftersales/:id/reject", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const operatorId = req.user!.id;
  const body = z.object({
    processRemark: z.string().min(1, "请填写拒绝原因"),
    version: z.number().default(1)
  }).parse(req.body);

  const result = await query(
    `UPDATE aftersale SET status = 'REJECTED', processed_by = ?, process_remark = ?, updated_at = NOW(), version = version + 1
     WHERE id = ? AND tenant_id = ? AND status = 'PENDING' AND version = ?`,
    [operatorId, body.processRemark, req.params.id, tenantId, body.version]
  );
  if ((result as any).affectedRows === 0) {
    res.status(400).json(fail("拒绝失败（状态已变更或版本不匹配）"));
    return;
  }
  res.json(ok({ message: "已拒绝" }));
}));

// POST /aftersales/:id/confirm-receipt - 确认收货
adminAftersaleRouter.post("/aftersales/:id/confirm-receipt", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await query(
    `UPDATE aftersale SET status = 'RECEIVED', updated_at = NOW(), version = version + 1
     WHERE id = ? AND tenant_id = ? AND status = 'RETURNING'`,
    [req.params.id, tenantId]
  );
  if ((result as any).affectedRows === 0) {
    res.status(400).json(fail("确认收货失败（状态不允许）"));
    return;
  }
  res.json(ok({ message: "已确认收货" }));
}));

// POST /aftersales/:id/inspect - 验货
adminAftersaleRouter.post("/aftersales/:id/inspect", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const operatorId = req.user!.id;
  const body = z.object({
    inspectResult: z.enum(["PASS", "PARTIAL_PASS", "FAIL"]),
    inspectImages: z.array(z.string()).optional(),
    processRemark: z.string().optional(),
    version: z.number().default(1)
  }).parse(req.body);

  const newStatus = body.inspectResult === "FAIL" ? "REJECTED" : "INSPECTING";
  const result = await query(
    `UPDATE aftersale SET status = ?, inspected_by = ?, inspect_result = ?, inspect_images = ?, updated_at = NOW(), version = version + 1
     WHERE id = ? AND tenant_id = ? AND status IN ('RECEIVED', 'INSPECTING') AND version = ?`,
    [
      newStatus, operatorId, body.processRemark || body.inspectResult,
      JSON.stringify(body.inspectImages || []), req.params.id, tenantId, body.version
    ]
  );
  if ((result as any).affectedRows === 0) {
    res.status(400).json(fail("验货失败（状态不允许或版本不匹配）"));
    return;
  }
  res.json(ok({ message: "验货完成", status: newStatus }));
}));

// POST /aftersales/:id/complete - 完成处理（退款/换货）
adminAftersaleRouter.post("/aftersales/:id/complete", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const operatorId = req.user!.id;
  const body = z.object({
    processRemark: z.string().optional(),
    version: z.number().default(1)
  }).parse(req.body);

  const result = await query(
    `UPDATE aftersale SET status = 'COMPLETED', processed_by = ?, process_remark = ?, updated_at = NOW(), version = version + 1
     WHERE id = ? AND tenant_id = ? AND status IN ('INSPECTING', 'APPROVED') AND version = ?`,
    [operatorId, body.processRemark || null, req.params.id, tenantId, body.version]
  );
  if ((result as any).affectedRows === 0) {
    res.status(400).json(fail("完成处理失败（状态不允许或版本不匹配）"));
    return;
  }
  res.json(ok({ message: "售后处理完成" }));
}));

// GET /aftersales/statistics - 售后统计
adminAftersaleRouter.get("/aftersales/statistics", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = req.query.storeId ? Number(req.query.storeId) : null;
  const storeFilter = storeId ? "WHERE tenant_id = ? AND store_id = ?" : "WHERE tenant_id = ?";
  const storeParams = storeId ? [tenantId, storeId] : [tenantId];

  // 各类型数量
  const typeStats = await query<any>(
    `SELECT aftersale_type AS type, COUNT(*) AS count FROM aftersale ${storeFilter} GROUP BY aftersale_type`,
    storeParams
  );

  // 各状态数量
  const statusStats = await query<any>(
    `SELECT status, COUNT(*) AS count FROM aftersale ${storeFilter} GROUP BY status`,
    storeParams
  );

  // 平均处理时效（小时）
  const avgTime = await queryOne<{ avgHours: string }>(
    `SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) AS avgHours
     FROM aftersale ${storeFilter} AND status IN ('COMPLETED', 'CLOSED')`,
    storeParams
  );

  // 平均满意度
  const avgSatisfaction = await queryOne<{ avgScore: string }>(
    `SELECT AVG(satisfaction) AS avgScore FROM aftersale ${storeFilter} AND satisfaction IS NOT NULL`,
    storeParams
  );

  // 超时率
  const totalPending = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM aftersale ${storeFilter} AND deadline IS NOT NULL`,
    storeParams
  );
  const totalOverdue = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM aftersale ${storeFilter} AND deadline IS NOT NULL AND status NOT IN ('COMPLETED', 'CLOSED', 'CANCELLED') AND deadline < NOW()`,
    storeParams
  );

  res.json(ok({
    typeStats: typeStats.map((r: any) => ({ type: r.type, typeLabel: AFTERSALE_TYPE_LABELS[r.type] || r.type, count: r.count })),
    statusStats: statusStats.map((r: any) => ({ status: r.status, statusLabel: AFTERSALE_STATUS_LABELS[r.status] || r.status, count: r.count })),
    avgProcessingHours: Number(Number(avgTime?.avgHours || 0).toFixed(1)),
    avgSatisfaction: Number(Number(avgSatisfaction?.avgScore || 0).toFixed(1)),
    overdueRate: totalPending?.total ? Number(((totalOverdue?.total || 0) / totalPending.total * 100).toFixed(1)) : 0
  }));
}));
