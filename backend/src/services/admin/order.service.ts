import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import type { RowDataPacket } from "mysql2/promise";
import { makeBizNo } from "../../shared/id";

// ==================== 类型定义 ====================

/** 小程序订单列表行 */
interface OrderListRow {
  orderNo: string;
  storeId: number;
  customerType: string;
  fulfillmentType: string;
  orderStatus: string;
  payStatus: string;
  payableAmount: number | string;
  receiverName: string;
  receiverMobile: string;
  createdAt: string | Date;
}

/** 计数 total 行 */
interface CountTotalRow {
  total: number;
}

/** 小程序订单详情行 */
interface OrderDetailRow {
  orderNo: string;
  storeId: number;
  customerType: string;
  fulfillmentType: string;
  orderStatus: string;
  payStatus: string;
  payableAmount: number | string;
  receiverName: string;
  receiverMobile: string;
  receiverAddress: string | null;
  createdAt: string | Date;
}

/** 小程序订单项行 */
interface OrderItemRow {
  skuId: number;
  skuName: string;
  quantity: number;
  unitPrice: number | string;
  subtotalAmount: number | string;
}

/** 订单状态统计行 */
interface OrderStatusStatRow {
  status: string;
  count: number;
}

/** 销售单列表行 */
interface SaleBillListRow {
  billNo: string;
  storeId: number;
  customerName: string;
  customerMobile: string;
  receivableAmount: number | string;
  receivedAmount: number | string;
  unreceivedAmount: number | string;
  collectionStatus: string;
  businessStatus: string;
  createdAt: string | Date;
}

/** 小程序订单全部字段行 */
interface OrderFullRow {
  order_no: string;
  order_status: string;
  pay_status: string;
  [key: string]: unknown;
}

/** 订单项（库存释放用） */
interface OrderItemQtyRow {
  sku_id: number;
  qty: number;
}

/** 操作日志行 */
interface OperationLogRow {
  logNo: string;
  module: string;
  action: string;
  bizNo: string;
  operatorId: number;
  operatorName: string;
  remark: string;
  createdAt: string | Date;
}

export async function listOrders(
  page: number,
  pageSize: number,
  keyword: string,
  status: string,
  dateStart: string,
  dateEnd: string,
  tenantId: string
) {
  const offset = (page - 1) * pageSize;
  const like = `%${keyword}%`;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (keyword) {
    conditions.push("(order_no LIKE ? OR receiver_name LIKE ? OR receiver_mobile LIKE ?)");
    params.push(like, like, like);
  }
  if (status) {
    conditions.push("order_status = ?");
    params.push(status);
  }
  if (dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(dateEnd);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<OrderListRow>(
    `SELECT order_no AS orderNo, store_id AS storeId, customer_type AS customerType,
            fulfillment_type AS fulfillmentType, order_status AS orderStatus,
            pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            created_at AS createdAt
     FROM t_miniapp_order ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_miniapp_order ${where}`,
    params,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function exportOrdersCsv(
  keyword: string,
  status: string,
  dateStart: string,
  dateEnd: string,
  tenantId: string
) {
  const like = `%${keyword}%`;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (keyword) {
    conditions.push("(order_no LIKE ? OR receiver_name LIKE ? OR receiver_mobile LIKE ?)");
    params.push(like, like, like);
  }
  if (status) {
    conditions.push("order_status = ?");
    params.push(status);
  }
  if (dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(dateEnd);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<OrderListRow>(
    `SELECT order_no AS orderNo, store_id AS storeId, customer_type AS customerType,
            fulfillment_type AS fulfillmentType, order_status AS orderStatus,
            pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            created_at AS createdAt
     FROM t_miniapp_order ${where}
     ORDER BY created_at DESC
     LIMIT 1000`,
    params,
    tenantId
  );
  const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["订单号", "门店ID", "客户类型", "履约方式", "订单状态", "支付状态", "金额", "收货人", "手机号", "创建时间"];
  const rows = records.map((row) => [
    row.orderNo,
    row.storeId,
    row.customerType,
    row.fulfillmentType,
    row.orderStatus,
    row.payStatus,
    row.payableAmount,
    row.receiverName,
    row.receiverMobile,
    row.createdAt
  ]);
  const csv = `\uFEFF${[header, ...rows].map((line) => line.map(escapeCsv).join(",")).join("\n")}`;
  return { csv, filename: `orders-${new Date().toISOString().slice(0, 10)}.csv` };
}

export async function getOrderDetail(orderNo: string, tenantId: string) {
  const order = await queryOneWithTenant<OrderDetailRow>(
    `SELECT order_no AS orderNo, store_id AS storeId, customer_type AS customerType,
            fulfillment_type AS fulfillmentType, order_status AS orderStatus,
            pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            receiver_address AS receiverAddress, created_at AS createdAt
     FROM t_miniapp_order WHERE order_no = ? AND tenant_id = ?`,
    [orderNo, tenantId],
    tenantId
  );
  if (!order) return null;
  const items = await queryWithTenant<OrderItemRow>(
    `SELECT sku_id AS skuId, sku_name AS skuName, qty AS quantity, unit_price AS unitPrice,
            subtotal_amount AS subtotalAmount
     FROM t_miniapp_order_item WHERE order_no = ?`,
    [orderNo],
    tenantId
  );
  return { ...order, items };
}

export async function getOrderStatusStats(tenantId: string) {
  const records = await queryWithTenant<OrderStatusStatRow>(
    `SELECT order_status AS status, COUNT(*) AS count
     FROM t_miniapp_order
     WHERE tenant_id = ?
     GROUP BY order_status`,
    [tenantId],
    tenantId
  );
  return records;
}

export async function listSaleBills(
  page: number,
  pageSize: number,
  keyword: string,
  status: string,
  dateStart: string,
  dateEnd: string,
  tenantId: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (keyword) {
    const like = `%${keyword}%`;
    conditions.push("(bill_no LIKE ? OR customer_name LIKE ?)");
    params.push(like, like);
  }
  if (status) {
    conditions.push("collection_status = ?");
    params.push(status);
  }
  if (dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<SaleBillListRow>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_name AS customerName,
            customer_mobile AS customerMobile, receivable_amount AS receivableAmount,
            received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount,
            collection_status AS collectionStatus, business_status AS businessStatus,
            created_at AS createdAt
     FROM t_sale_bill
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>(`SELECT COUNT(*) AS total FROM t_sale_bill ${where}`, params, tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function exportSaleBillsCsv(
  keyword: string,
  status: string,
  dateStart: string,
  dateEnd: string,
  tenantId: string
) {
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (keyword) {
    const like = `%${keyword}%`;
    conditions.push("(bill_no LIKE ? OR customer_name LIKE ?)");
    params.push(like, like);
  }
  if (status) {
    conditions.push("collection_status = ?");
    params.push(status);
  }
  if (dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<SaleBillListRow>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_name AS customerName,
            customer_mobile AS customerMobile, receivable_amount AS receivableAmount,
            received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount,
            collection_status AS collectionStatus, business_status AS businessStatus,
            created_at AS createdAt
     FROM t_sale_bill
     ${where}
     ORDER BY created_at DESC
     LIMIT 5000`,
    params,
    tenantId
  );
  const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["销售单号", "门店ID", "客户名称", "客户手机", "应收金额", "已收金额", "未收金额", "收款状态", "业务状态", "创建时间"];
  const rows = records.map((row) => [
    row.billNo, row.storeId, row.customerName, row.customerMobile,
    row.receivableAmount, row.receivedAmount, row.unreceivedAmount,
    row.collectionStatus, row.businessStatus, row.createdAt
  ]);
  const csv = `\uFEFF${[header, ...rows].map((line) => line.map(escapeCsv).join(",")).join("\n")}`;
  return { csv, filename: `sale-bills-${new Date().toISOString().slice(0, 10)}.csv` };
}

// ========== Phase 12: 订单状态管理 ==========

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["DELIVERING", "CANCELLED"],
  DELIVERING: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function validateStatusTransition(from: string, to: string): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export async function cancelOrder(orderNo: string, reason: string, operatorId: number | null, operatorName: string, tenantId: string) {
  const order = await queryOneWithTenant<OrderFullRow>(
    "SELECT * FROM t_miniapp_order WHERE order_no = ? AND tenant_id = ?",
    [orderNo, tenantId],
    tenantId
  );
  if (!order) throw new Error("订单不存在");
  if (order.order_status === "CANCELLED") throw new Error("订单已取消");
  if (order.order_status === "COMPLETED") throw new Error("已完成订单无法取消");

  await transaction(async (conn) => {
    await conn.execute(
      "UPDATE t_miniapp_order SET order_status = 'CANCELLED', pay_status = CASE WHEN pay_status = 'UNPAID' THEN 'CANCELLED' ELSE pay_status END, updated_at = NOW() WHERE order_no = ? AND tenant_id = ?",
      [orderNo, tenantId]
    );
    // 释放库存
    const items = await conn.execute<RowDataPacket[]>(
      "SELECT sku_id, qty FROM t_miniapp_order_item WHERE order_no = ? AND tenant_id = ?",
      [orderNo, tenantId]
    );
    for (const item of items[0] as OrderItemQtyRow[]) {
      await conn.execute(
        "UPDATE t_inventory_balance SET available_qty = available_qty + ?, locked_qty = locked_qty - ? WHERE sku_id = ? AND tenant_id = ?",
        [item.qty, item.qty, item.sku_id, tenantId]
      );
    }
    // 记录操作日志
    const logNo = makeBizNo("LOG");
    await conn.execute(
      "INSERT INTO t_operation_log (log_no, module, action, biz_no, operator_id, operator_name, remark, tenant_id) VALUES (?, 'ORDER', 'CANCEL', ?, ?, ?, ?, ?)",
      [logNo, orderNo, operatorId ?? 0, operatorName, reason || "管理员取消订单", tenantId]
    );
  });
  return { orderNo, status: "CANCELLED" };
}

export async function remarkOrder(orderNo: string, remark: string, operatorId: number | null, operatorName: string, tenantId: string) {
  const order = await queryOneWithTenant<OrderFullRow>(
    "SELECT * FROM t_miniapp_order WHERE order_no = ? AND tenant_id = ?",
    [orderNo, tenantId],
    tenantId
  );
  if (!order) throw new Error("订单不存在");

  await transaction(async (conn) => {
    await conn.execute(
      "UPDATE t_miniapp_order SET remark = ?, updated_at = NOW() WHERE order_no = ? AND tenant_id = ?",
      [remark, orderNo, tenantId]
    );
    const logNo = makeBizNo("LOG");
    await conn.execute(
      "INSERT INTO t_operation_log (log_no, module, action, biz_no, operator_id, operator_name, remark, tenant_id) VALUES (?, 'ORDER', 'REMARK', ?, ?, ?, ?, ?)",
      [logNo, orderNo, operatorId ?? 0, operatorName, remark, tenantId]
    );
  });
  return { orderNo, remark };
}

export async function updateOrderStatus(orderNo: string, targetStatus: string, operatorId: number | null, operatorName: string, remark: string | null, tenantId: string) {
  const order = await queryOneWithTenant<OrderFullRow>(
    "SELECT * FROM t_miniapp_order WHERE order_no = ? AND tenant_id = ?",
    [orderNo, tenantId],
    tenantId
  );
  if (!order) throw new Error("订单不存在");
  if (!validateStatusTransition(order.order_status, targetStatus)) {
    throw new Error(`订单状态不能从 ${order.order_status} 变更为 ${targetStatus}`);
  }

  await transaction(async (conn) => {
    await conn.execute(
      "UPDATE t_miniapp_order SET order_status = ?, updated_at = NOW() WHERE order_no = ? AND tenant_id = ?",
      [targetStatus, orderNo, tenantId]
    );
    const logNo = makeBizNo("LOG");
    await conn.execute(
      "INSERT INTO t_operation_log (log_no, module, action, biz_no, operator_id, operator_name, remark, tenant_id) VALUES (?, 'ORDER', 'STATUS_CHANGE', ?, ?, ?, ?, ?)",
      [logNo, orderNo, operatorId ?? 0, operatorName, remark || `状态变更: ${order.order_status} -> ${targetStatus}`, tenantId]
    );
  });
  return { orderNo, fromStatus: order.order_status, toStatus: targetStatus };
}

export async function batchUpdateOrderStatus(orderNos: string[], targetStatus: string, operatorId: number | null, operatorName: string, tenantId: string) {
  const results: { orderNo: string; success: boolean; error?: string }[] = [];
  for (const orderNo of orderNos) {
    try {
      await updateOrderStatus(orderNo, targetStatus, operatorId, operatorName, null, tenantId);
      results.push({ orderNo, success: true });
    } catch (err: any) {
      results.push({ orderNo, success: false, error: err.message });
    }
  }
  return { results, total: orderNos.length, successCount: results.filter(r => r.success).length };
}

export async function getOrderOperationLogs(orderNo: string, tenantId: string) {
  return queryWithTenant<OperationLogRow>(
    "SELECT log_no AS logNo, module, action, biz_no AS bizNo, operator_id AS operatorId, operator_name AS operatorName, remark, created_at AS createdAt FROM t_operation_log WHERE biz_no = ? AND module = 'ORDER' AND tenant_id = ? ORDER BY created_at DESC",
    [orderNo, tenantId],
    tenantId
  );
}