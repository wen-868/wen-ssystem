import { query, queryOne, transaction } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

// ==================== 小程序端 ====================

// 1. 创建售后申请
export async function createAftersale(params: {
  tenantId: string;
  customerId: number;
  orderNo: string;
  aftersaleType: string;
  reason: string;
  reasonDetail?: string;
  images?: string[];
  items: Array<{ skuId: number; skuName: string; qty: number; unitPrice: number; subtotal: number }>;
  refundAmount: number;
  exchangeSkuId?: number;
  exchangeQty?: number;
}) {
  const { tenantId, customerId, orderNo, aftersaleType, reason, reasonDetail, images, items, refundAmount, exchangeSkuId, exchangeQty } = params;

  const order = await queryOne<Record<string, unknown>>(
    `SELECT id, order_no, store_id, member_id, order_status FROM miniapp_order WHERE order_no = ? AND member_id = ? AND tenant_id = ?`,
    [orderNo, customerId, tenantId]
  );
  if (!order) throw Object.assign(new Error("订单不存在"), { statusCode: 404 });
  if (order.order_status === "CANCELLED") throw Object.assign(new Error("已取消的订单不可申请售后"), { statusCode: 400 });

  const existingAftersale = await queryOne<Record<string, unknown>>(
    `SELECT id FROM aftersale WHERE order_no = ? AND customer_id = ? AND tenant_id = ? AND status NOT IN ('CANCELLED', 'COMPLETED', 'REJECTED', 'EXPIRED', 'CLOSED')`,
    [orderNo, customerId, tenantId]
  );
  if (existingAftersale) throw Object.assign(new Error("该订单已有进行中的售后申请"), { statusCode: 400 });

  const aftersaleNo = makeBizNo("AS");
  const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await query(
    `INSERT INTO aftersale (aftersale_no, order_id, order_no, customer_id, store_id, aftersale_type,
                              reason, reason_detail, images, items, refund_amount, exchange_sku_id, exchange_qty,
                              status, deadline, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
    [
      aftersaleNo, order.id, orderNo, customerId, order.store_id, aftersaleType,
      reason, reasonDetail ?? null, JSON.stringify(images || []), JSON.stringify(items),
      refundAmount, exchangeSkuId ?? null, exchangeQty ?? null, deadline, tenantId
    ]
  );

  return { aftersaleNo, status: "PENDING", deadline: deadline.toISOString(), message: "售后申请已提交" };
}

// 2. 我的售后列表
export async function listMyAftersales(params: {
  tenantId: string;
  customerId: number;
  status?: string;
  page: number;
  pageSize: number;
}) {
  const { tenantId, customerId, status, page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  let whereSql = "WHERE a.customer_id = ? AND a.tenant_id = ?";
  const queryParams: unknown[] = [customerId, tenantId];
  if (status) {
    whereSql += " AND a.status = ?";
    queryParams.push(status);
  }

  const records = await query<Record<string, unknown>>(
    `SELECT a.id, a.aftersale_no AS aftersaleNo, a.order_no AS orderNo, a.aftersale_type AS aftersaleType,
            a.reason, a.refund_amount AS refundAmount, a.status, a.deadline,
            a.return_logistics_no AS returnLogisticsNo,
            a.created_at AS createdAt, a.updated_at AS updatedAt
     FROM aftersale a ${whereSql}
     ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  );

  const total = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM aftersale a ${whereSql}`,
    queryParams
  );

  return { total: total?.total ?? 0, page, pageSize, records };
}

// 3. 售后详情
export async function getAftersaleDetail(aftersaleNo: string, customerId: number, tenantId: string) {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT a.*, o.receiver_name AS orderReceiverName, o.receiver_mobile AS orderReceiverMobile
     FROM aftersale a
     LEFT JOIN miniapp_order o ON o.order_no = a.order_no AND o.tenant_id = a.tenant_id
     WHERE a.aftersale_no = ? AND a.customer_id = ? AND a.tenant_id = ?`,
    [aftersaleNo, customerId, tenantId]
  );
  if (!row) throw Object.assign(new Error("售后单不存在"), { statusCode: 404 });
  return row;
}

// 4. 取消售后
export async function cancelAftersale(aftersaleNo: string, customerId: number, tenantId: string) {
  const result = await query(
    `UPDATE aftersale SET status = 'CANCELLED', updated_at = NOW()
     WHERE aftersale_no = ? AND customer_id = ? AND tenant_id = ? AND status = 'PENDING'`,
    [aftersaleNo, customerId, tenantId]
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    throw Object.assign(new Error("无法取消（非待审核状态或不属于您）"), { statusCode: 400 });
  }
  return { message: "售后已取消" };
}

// 5. 填写退货物流
export async function submitReturnLogistics(params: {
  aftersaleNo: string;
  customerId: number;
  tenantId: string;
  returnLogisticsNo: string;
  returnLogisticsCompany: string;
}) {
  const { aftersaleNo, customerId, tenantId, returnLogisticsNo, returnLogisticsCompany } = params;
  const result = await query(
    `UPDATE aftersale SET return_logistics_no = ?, return_logistics_company = ?, status = 'RETURNING', updated_at = NOW()
     WHERE aftersale_no = ? AND customer_id = ? AND tenant_id = ? AND status IN ('APPROVED', 'RETURNING')`,
    [returnLogisticsNo, returnLogisticsCompany, aftersaleNo, customerId, tenantId]
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    throw Object.assign(new Error("无法填写物流（状态不允许或不属于您）"), { statusCode: 400 });
  }
  return { message: "物流信息已填写" };
}

// 6. 评价售后处理
export async function rateAftersale(params: {
  aftersaleNo: string;
  customerId: number;
  tenantId: string;
  satisfaction: number;
  customerComment?: string;
}) {
  const { aftersaleNo, customerId, tenantId, satisfaction, customerComment } = params;
  const result = await query(
    `UPDATE aftersale SET satisfaction = ?, customer_comment = ?, updated_at = NOW()
     WHERE aftersale_no = ? AND customer_id = ? AND tenant_id = ? AND status = 'COMPLETED'`,
    [satisfaction, customerComment ?? null, aftersaleNo, customerId, tenantId]
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    throw Object.assign(new Error("无法评价（仅已完成状态可评价）"), { statusCode: 400 });
  }
  return { message: "评价成功" };
}

// ==================== 管理端 ====================

// 7. 售后列表（筛选+分页）
export async function listAftersales(params: {
  tenantId: string;
  status?: string;
  storeId?: number;
  startDate?: string;
  endDate?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}) {
  const { tenantId, status, storeId, startDate, endDate, keyword, page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = ["a.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (status) { conditions.push("a.status = ?"); queryParams.push(status); }
  if (storeId) { conditions.push("a.store_id = ?"); queryParams.push(storeId); }
  if (startDate) { conditions.push("a.created_at >= ?"); queryParams.push(startDate); }
  if (endDate) { conditions.push("a.created_at <= ?"); queryParams.push(endDate + " 23:59:59"); }
  if (keyword) { conditions.push("(a.aftersale_no LIKE ? OR a.order_no LIKE ? OR a.reason LIKE ?)"); queryParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }

  const whereSql = `WHERE ${conditions.join(" AND ")}`;

  const records = await query<Record<string, unknown>>(
    `SELECT a.id, a.aftersale_no AS aftersaleNo, a.order_no AS orderNo, a.customer_id AS customerId,
            a.store_id AS storeId, a.aftersale_type AS aftersaleType, a.reason, a.refund_amount AS refundAmount,
            a.status, a.deadline, a.return_logistics_no AS returnLogisticsNo,
            a.return_logistics_company AS returnLogisticsCompany,
            a.created_at AS createdAt, a.updated_at AS updatedAt
     FROM aftersale a ${whereSql}
     ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  );

  const total = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM aftersale a ${whereSql}`,
    queryParams
  );

  return { total: total?.total ?? 0, page, pageSize, records };
}

// 8. 售后详情（完整信息）
export async function getAftersaleDetailById(id: number, tenantId: string) {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT a.*,
            o.receiver_name AS orderReceiverName, o.receiver_mobile AS orderReceiverMobile, o.receiver_address AS orderReceiverAddress
     FROM aftersale a
     LEFT JOIN miniapp_order o ON o.order_no = a.order_no AND o.tenant_id = a.tenant_id
     WHERE a.id = ? AND a.tenant_id = ?`,
    [id, tenantId]
  );
  if (!row) throw Object.assign(new Error("售后单不存在"), { statusCode: 404 });
  return row;
}

// 9. 审核通过
export async function approveAftersale(id: number, tenantId: string, operatorId: number, processRemark?: string, version?: number) {
  const result = await query(
    `UPDATE aftersale SET status = 'APPROVED', processed_by = ?, process_remark = ?, updated_at = NOW(), version = version + 1
     WHERE id = ? AND tenant_id = ? AND status = 'PENDING' AND version = ?`,
    [operatorId, processRemark || null, id, tenantId, version || 1]
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    throw Object.assign(new Error("审核失败（状态已变更或版本不匹配）"), { statusCode: 400 });
  }
  return { message: "审核通过" };
}

// 10. 审核拒绝
export async function rejectAftersale(id: number, tenantId: string, operatorId: number, processRemark: string, version?: number) {
  const result = await query(
    `UPDATE aftersale SET status = 'REJECTED', processed_by = ?, process_remark = ?, updated_at = NOW(), version = version + 1
     WHERE id = ? AND tenant_id = ? AND status = 'PENDING' AND version = ?`,
    [operatorId, processRemark, id, tenantId, version || 1]
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    throw Object.assign(new Error("拒绝失败（状态已变更或版本不匹配）"), { statusCode: 400 });
  }
  return { message: "已拒绝" };
}

// 11. 确认收货
export async function confirmReceipt(id: number, tenantId: string) {
  const result = await query(
    `UPDATE aftersale SET status = 'RECEIVED', updated_at = NOW(), version = version + 1
     WHERE id = ? AND tenant_id = ? AND status = 'RETURNING'`,
    [id, tenantId]
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    throw Object.assign(new Error("确认收货失败（状态不允许）"), { statusCode: 400 });
  }
  return { message: "已确认收货" };
}

// 12. 验货
export async function inspectAftersale(params: {
  id: number;
  tenantId: string;
  operatorId: number;
  inspectResult: string;
  inspectImages?: string[];
  processRemark?: string;
  version?: number;
}) {
  const { id, tenantId, operatorId, inspectResult, inspectImages, processRemark, version } = params;
  const newStatus = inspectResult === "FAIL" ? "REJECTED" : "INSPECTING";
  const result = await query(
    `UPDATE aftersale SET status = ?, inspected_by = ?, inspect_result = ?, inspect_images = ?, updated_at = NOW(), version = version + 1
     WHERE id = ? AND tenant_id = ? AND status IN ('RECEIVED', 'INSPECTING') AND version = ?`,
    [
      newStatus, operatorId, processRemark || inspectResult,
      JSON.stringify(inspectImages || []), id, tenantId, version || 1
    ]
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    throw Object.assign(new Error("验货失败（状态不允许或版本不匹配）"), { statusCode: 400 });
  }
  return { message: "验货完成", status: newStatus };
}

// 13. 完成处理
export async function completeAftersale(params: {
  id: number;
  tenantId: string;
  operatorId: number;
  processRemark?: string;
  version?: number;
}) {
  const { id, tenantId, operatorId, processRemark, version } = params;
  const result = await query(
    `UPDATE aftersale SET status = 'COMPLETED', processed_by = ?, process_remark = ?, updated_at = NOW(), version = version + 1
     WHERE id = ? AND tenant_id = ? AND status IN ('INSPECTING', 'APPROVED') AND version = ?`,
    [operatorId, processRemark || null, id, tenantId, version || 1]
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    throw Object.assign(new Error("完成处理失败（状态不允许或版本不匹配）"), { statusCode: 400 });
  }
  return { message: "售后处理完成" };
}

// 14. 售后统计
export async function getAftersaleStatistics(tenantId: string, storeId?: number) {
  const storeFilter = storeId ? "WHERE tenant_id = ? AND store_id = ?" : "WHERE tenant_id = ?";
  const storeParams = storeId ? [tenantId, storeId] : [tenantId];

  const typeStats = await query<Record<string, unknown>>(
    `SELECT aftersale_type AS type, COUNT(*) AS count FROM aftersale ${storeFilter} GROUP BY aftersale_type`,
    storeParams
  );

  const statusStats = await query<Record<string, unknown>>(
    `SELECT status, COUNT(*) AS count FROM aftersale ${storeFilter} GROUP BY status`,
    storeParams
  );

  const avgTime = await queryOne<{ avgHours: string }>(
    `SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) AS avgHours
     FROM aftersale ${storeFilter} AND status IN ('COMPLETED', 'CLOSED')`,
    storeParams
  );

  const avgSatisfaction = await queryOne<{ avgScore: string }>(
    `SELECT AVG(satisfaction) AS avgScore FROM aftersale ${storeFilter} AND satisfaction IS NOT NULL`,
    storeParams
  );

  const totalPending = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM aftersale ${storeFilter} AND deadline IS NOT NULL`,
    storeParams
  );
  const totalOverdue = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM aftersale ${storeFilter} AND deadline IS NOT NULL AND status NOT IN ('COMPLETED', 'CLOSED', 'CANCELLED') AND deadline < NOW()`,
    storeParams
  );

  return {
    typeStats,
    statusStats,
    avgProcessingHours: Number(Number(avgTime?.avgHours || 0).toFixed(1)),
    avgSatisfaction: Number(Number(avgSatisfaction?.avgScore || 0).toFixed(1)),
    overdueRate: totalPending?.total ? Number(((totalOverdue?.total || 0) / totalPending.total * 100).toFixed(1)) : 0
  };
}