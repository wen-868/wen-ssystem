import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import { completeOrderDelivery } from "../../shared/fulfillment";
import { updateTraceCodesBySkuList } from "../../shared/trace-code";
import type { RowDataPacket } from "mysql2";

// ─── 类型定义 ─────────────────────────────────────────────────

/** 订单列表行 */
interface OrderRow {
  orderNo: string;
  storeId: number;
  fulfillmentType: string;
  orderStatus: string;
  payStatus: string;
  payableAmount: number;
  receiverName: string;
  receiverMobile: string;
  receiverAddress: string;
  createdAt: Date | string;
}

/** 订单详情行 */
interface OrderDetailRow {
  orderNo: string;
  storeId: number;
  customerType: string;
  fulfillmentType: string;
  orderStatus: string;
  payStatus: string;
  payableAmount: number;
  receiverName: string;
  receiverMobile: string;
  receiverAddress: string;
  createdAt: Date | string;
}

/** 订单项行 */
interface OrderItemRow {
  skuId: number;
  skuName: string;
  quantity: number;
  unitPrice: number;
  subtotalAmount: number;
}

/** 总数行 */
interface CountRow {
  total: number;
}

/** 订单行（事务查询用） */
interface OrderConnRow extends RowDataPacket {
  order_no: string;
  store_id: number;
  tenantId?: string;
}

/** 订单项行（事务查询用） */
interface OrderItemConnRow extends RowDataPacket {
  skuId: number;
  sku_id?: number;
  reservedQty: number;
}

/** 订单租户行 */
interface OrderTenantRow extends RowDataPacket {
  tenantId: string;
}

/** SKU ID 行 */
interface SkuIdRow extends RowDataPacket {
  sku_id: number;
}

export async function listOrders(params: {
  page: number;
  pageSize: number;
  storeId: number | null;
  status: string | null;
  tenantId: string;
}) {
  const { page, pageSize, storeId, status, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<OrderRow>(
    `SELECT order_no AS orderNo, store_id AS storeId, fulfillment_type AS fulfillmentType,
            order_status AS orderStatus, pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile, receiver_address AS receiverAddress,
            created_at AS createdAt
     FROM t_miniapp_order
     WHERE tenant_id = ?
       AND (? IS NULL OR store_id = ?)
       AND (? IS NULL OR order_status = ?)
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, storeId, storeId, status, status, pageSize, offset],
    tenantId
  );
  const total = await queryOneWithTenant<CountRow>(
    `SELECT COUNT(*) AS total FROM t_miniapp_order
     WHERE tenant_id = ?
       AND (? IS NULL OR store_id = ?)
       AND (? IS NULL OR order_status = ?)`,
    [tenantId, storeId, storeId, status, status],
    tenantId
  );
  return { total: total?.total ?? 0, page, pageSize, records };
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

export async function acceptOrder(orderNo: string, tenantId: string) {
  const result = await queryWithTenant(
    `UPDATE t_miniapp_order SET order_status = 'ACCEPTED', updated_at = NOW() WHERE order_no = ? AND tenant_id = ?`,
    [orderNo, tenantId],
    tenantId
  );
  if (!result || (result as unknown as { affectedRows: number }).affectedRows === 0) return null;
  return { orderNo, status: "ACCEPTED" };
}

export async function startDelivery(orderNo: string, tenantId: string, userId: number | null, username: string) {
  const result = await queryWithTenant(
    `UPDATE t_miniapp_order
     SET order_status = 'DELIVERING', delivery_status = 'DELIVERING', updated_at = NOW()
     WHERE order_no = ? AND order_status = 'WAIT_DELIVERY' AND tenant_id = ?`,
    [orderNo, tenantId],
    tenantId
  );
  if (!result || (result as unknown as { affectedRows: number }).affectedRows === 0) return null;
  await queryWithTenant(
    `INSERT INTO t_operation_log (operator_id, operator_name, module, action, biz_no, after_data, tenant_id)
     VALUES (?, ?, 'ORDER_DELIVERY', 'START_DELIVERY', ?, JSON_OBJECT('status', 'DELIVERING'), ?)`,
    [userId ?? null, username ?? "系统用户", orderNo, tenantId],
    tenantId
  );
  return { orderNo, status: "DELIVERING" };
}

export async function completeDelivery(orderNo: string, userId: number | null) {
  return transaction(async (conn) => {
    const result = await completeOrderDelivery(conn, orderNo, userId ?? null, makeBizNo);

    // R9-2: 配送完成时消费追溯码
    const [orderRows] = await conn.query<OrderTenantRow[]>(
      `SELECT tenant_id AS tenantId FROM t_miniapp_order WHERE order_no = ?`,
      [orderNo]
    );
    const tenantId = orderRows[0]?.tenantId;
    if (tenantId) {
      const [items] = await conn.query<SkuIdRow[]>(
        `SELECT sku_id FROM t_miniapp_order_item WHERE order_no = ?`,
        [orderNo]
      );
      const skuIds = items.map((it) => it.sku_id);
      if (skuIds.length > 0) {
        await updateTraceCodesBySkuList(conn, tenantId, orderNo, skuIds);
      }
    }

    return result;
  });
}

async function releaseOrderReservation(orderNo: string, status: "REJECTED" | "CANCELLED", operatorId: number | null, tenantId: string) {
  return transaction(async (conn) => {
    const [orders] = await conn.query<OrderConnRow[]>(
      `SELECT order_no, store_id FROM t_miniapp_order
       WHERE order_no = ? AND order_status IN ('WAIT_DELIVERY', 'DELIVERING') AND tenant_id = ?
       FOR UPDATE`,
      [orderNo, tenantId]
    );
    const order = orders[0];
    if (!order) throw new Error("订单不存在或状态不可释放库存");
    const [items] = await conn.query<OrderItemConnRow[]>(
      `SELECT sku_id AS skuId, reserved_qty AS reservedQty FROM t_miniapp_order_item WHERE order_no = ?`,
      [orderNo]
    );
    for (const item of items) {
      const qty = Number(item.reservedQty ?? 0);
      if (qty <= 0) continue;
      await conn.execute(
        `UPDATE t_inventory_balance
         SET locked_qty = GREATEST(locked_qty - ?, 0),
             available_qty = available_qty + ?,
             updated_at = NOW()
         WHERE store_id = ? AND sku_id = ? AND stock_type = 'ONLINE' AND tenant_id = ?`,
        [qty, qty, order.store_id, item.skuId, tenantId]
      );
      await conn.execute(
        `INSERT INTO t_inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
                                       change_qty, before_qty, after_qty, before_locked_qty, after_locked_qty,
                                       operator_id, idempotency_key, remark, tenant_id)
         VALUES (?, ?, ?, 'ONLINE', ?, ?, 0, 0, 0, 0, 0, ?, ?, ?, ?)`,
        [
          makeBizNo("IL"), order.store_id, item.skuId,
          status === "REJECTED" ? "ORDER_REJECT" : "ORDER_CANCEL",
          orderNo, operatorId, `${status}:${orderNo}:${item.skuId}`,
          status === "REJECTED" ? "客户拒收释放占用库存" : "订单取消释放占用库存",
          tenantId
        ]
      );
    }
    await conn.execute(
      `UPDATE t_miniapp_order
       SET order_status = ?, delivery_status = ?, updated_at = NOW()
       WHERE order_no = ? AND tenant_id = ?`,
      [status, status, orderNo, tenantId]
    );
    return { orderNo, status };
  });
}

export async function rejectOrder(orderNo: string, operatorId: number | null, tenantId: string) {
  return releaseOrderReservation(orderNo, "REJECTED", operatorId, tenantId);
}

export async function cancelOrder(orderNo: string, operatorId: number | null, tenantId: string) {
  return releaseOrderReservation(orderNo, "CANCELLED", operatorId, tenantId);
}