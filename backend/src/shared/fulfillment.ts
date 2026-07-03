export type CustomerType = "RETAIL" | "WHOLESALE";
export type PayStatus = "UNPAID" | "PAID" | "PARTIAL";
export type OrderStatus =
  | "PENDING_PAYMENT"
  | "WAIT_DELIVERY"
  | "DELIVERING"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type FulfillmentAction = "START_DELIVERY" | "COMPLETE" | "REJECT" | "CANCEL";

export function calcReservation(input: { orderQty: number; availableQty: number }) {
  const orderQty = Math.max(0, Math.trunc(input.orderQty));
  const availableQty = Math.max(0, Math.trunc(input.availableQty));
  const reservedQty = Math.min(orderQty, availableQty);
  return {
    reservedQty,
    unreservedQty: orderQty - reservedQty
  };
}

export function getInitialMiniappOrderState(customerType: CustomerType): {
  orderStatus: OrderStatus;
  payStatus: PayStatus;
} {
  if (customerType === "WHOLESALE") {
    return { orderStatus: "WAIT_DELIVERY", payStatus: "UNPAID" };
  }
  return { orderStatus: "PENDING_PAYMENT", payStatus: "UNPAID" };
}

export function nextFulfillmentState(current: OrderStatus, action: FulfillmentAction): OrderStatus {
  if (action === "START_DELIVERY") {
    if (current !== "WAIT_DELIVERY") throw new Error("只有待配送订单可以开始配送");
    return "DELIVERING";
  }
  if (action === "COMPLETE") {
    if (current !== "WAIT_DELIVERY" && current !== "DELIVERING") throw new Error("只有待配送或配送中订单可以完成");
    return "COMPLETED";
  }
  if (action === "REJECT") {
    if (current !== "WAIT_DELIVERY" && current !== "DELIVERING") throw new Error("只有待配送或配送中订单可以拒收");
    return "REJECTED";
  }
  if (action === "CANCEL") {
    if (current === "COMPLETED") throw new Error("已完成订单不能取消");
    return "CANCELLED";
  }
  throw new Error("未知履约动作");
}

/**
 * 完成订单配送：扣减库存占用、更新订单状态、生成账期应收。
 * 供商家端 complete-delivery 和小程序 confirm-receipt 复用。
 */
export async function completeOrderDelivery(
  conn: any,
  orderNo: string,
  operatorId: number | null,
  tenantId: string,
  makeBizNo: (prefix: string) => string
): Promise<{ orderNo: string; status: string; receivableNo: string | null }> {
  const [orders]: any[] = await conn.query(
    `SELECT order_no, store_id, member_id, customer_type, settlement_type, payable_amount, receiver_name, receiver_mobile
     FROM miniapp_order
     WHERE order_no = ? AND order_status IN ('WAIT_DELIVERY', 'DELIVERING')
       AND tenant_id = ?
     FOR UPDATE`,
    [orderNo, tenantId]
  );
  const order = orders[0];
  if (!order) throw new Error("订单不存在或状态不可完成");

  const [items]: any[] = await conn.query(
    `SELECT sku_id AS skuId, qty AS quantity, reserved_qty AS reservedQty
     FROM miniapp_order_item WHERE order_no = ?`,
    [orderNo]
  );

  for (const item of items) {
    const deductQty = Number(item.reservedQty ?? 0);
    if (deductQty <= 0) continue;
    await conn.execute(
      `UPDATE inventory_balance
       SET physical_qty = physical_qty - ?,
           locked_qty = GREATEST(locked_qty - ?, 0),
           updated_at = NOW()
       WHERE store_id = ? AND sku_id = ? AND stock_type = 'ONLINE' AND tenant_id = ?`,
      [deductQty, deductQty, order.store_id, item.skuId, tenantId]
    );
    await conn.execute(
      `INSERT INTO inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
                                     change_qty, before_qty, after_qty, before_locked_qty, after_locked_qty,
                                     operator_id, idempotency_key, remark, tenant_id)
       VALUES (?, ?, ?, 'ONLINE', 'ORDER_COMPLETE', ?, ?, 0, 0, 0, 0, ?, ?, ?, ?)`,
      [
        makeBizNo("IL"),
        order.store_id,
        item.skuId,
        orderNo,
        -deductQty,
        operatorId,
        `ORDER_COMPLETE:${orderNo}:${item.skuId}`,
        "配送完成扣减库存",
        tenantId
      ]
    );
  }

  await conn.execute(
    `UPDATE miniapp_order
     SET order_status = 'COMPLETED', delivery_status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
     WHERE order_no = ? AND tenant_id = ?`,
    [orderNo, tenantId]
  );

  let receivableNo: string | null = null;
  if (order.customer_type === "WHOLESALE" && order.settlement_type === "ACCOUNT") {
    receivableNo = makeBizNo("YS");
    await conn.execute(
      `INSERT INTO receivable_account (receivable_no, source_type, source_no, store_id, customer_id, customer_name,
                                       customer_mobile, receivable_amount, received_amount, unreceived_amount, status, tenant_id)
       VALUES (?, 'MINIAPP_ORDER', ?, ?, ?, ?, ?, ?, 0, ?, 'UNPAID', ?)`,
      [
        receivableNo,
        orderNo,
        order.store_id,
        order.member_id,
        order.receiver_name,
        order.receiver_mobile,
        order.payable_amount,
        order.payable_amount,
        tenantId
      ]
    );
  }

  return { orderNo, status: "COMPLETED", receivableNo };
}
