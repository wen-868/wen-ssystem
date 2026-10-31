import type { PoolConnection } from "mysql2/promise";
import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import { completeOrderDelivery } from "../../shared/fulfillment";
import { updateTraceCodesBySkuList } from "../../shared/trace-code";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import {
  appendOrderProgressEvent,
  miniappRetailEvent,
  appendMiniappRetailCompletedEvent,
} from "../../shared/order-progress-events";

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
  /** 商品金额（t_miniapp_order.goods_amount） */
  goodsAmount: number | string;
  /** 优惠金额（t_miniapp_order.discount_amount） */
  discountAmount: number | string;
  payableAmount: number | string;
  /** 已付金额（t_miniapp_order.paid_amount）——R102-08 补返回，此前缺失导致"已付恒 0" */
  paidAmount: number | string;
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
  customer_type?: string;
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
            pay_status AS payStatus,
            goods_amount AS goodsAmount, discount_amount AS discountAmount,
            payable_amount AS payableAmount, paid_amount AS paidAmount,
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

// ─── miniapp_retail 事件写点辅助（本卡仅处理 RETAIL 族，批发单不外扩）───────────

/** 主表真值行（同事务内读取，business_status 不反推） */
interface MiniappRetailTruthRow extends RowDataPacket {
  store_id?: number | string;
  customer_type?: string;
  order_status: string;
}

/**
 * 若该单属 miniapp_retail（customer_type=RETAIL）则在同一事务内写事件；
 * 其他族（批发单 WHOLESALE）跳过 ⇒ 不冒充本族事件（红线 §七）。
 */
async function appendMiniappRetailEventIfRetail(
  order: MiniappRetailTruthRow,
  args: {
    conn: PoolConnection;
    tenantId: string;
    orderNo: string;
    businessStage: "ACCEPTED" | "DELIVERING" | "CANCELLED" | "COMPLETED" | "PENDING_SHIP" | "REJECTED";
    businessStatus: string;
    upstreamBizKey: string;
    actorFallback: string;
    actorType?: "system" | "user" | "admin" | "ai" | "cron";
    actorId?: number | string | null;
    statusReason?: string | null;
    failureCode?: string | null;
    retryEntry?: string | null;
  },
): Promise<boolean> {
  if ((order.customer_type ?? "RETAIL") !== "RETAIL") return false;
  await appendOrderProgressEvent(args.conn, miniappRetailEvent({
    tenantId: args.tenantId,
    storeId: order.store_id ?? null,
    orderNo: args.orderNo,
    businessStage: args.businessStage,
    businessStatus: args.businessStatus,
    actorType: args.actorType ?? "user",
    actorId: args.actorId ?? null,
    upstreamBizKey: args.upstreamBizKey,
    failureCode: args.failureCode ?? null,
    retryEntry: args.retryEntry ?? null,
    statusReason: args.statusReason ?? null,
    at: new Date(),
    actorFallback: args.actorFallback,
  }));
  return true;
}

/**
 * 门店接单（TOTAL-ORDER-PROGRESS-03：包事务 ⇒ 状态变更与 ACCEPTED 事件同一事务，契约 §8.1）。
 * 语义保持：订单不可命中 ⇒ 返回 null（原 UPDATE affectedRows=0 口径）。
 */
export async function acceptOrder(orderNo: string, tenantId: string) {
  return transaction(async (conn) => {
    const [before] = await conn.execute<MiniappRetailTruthRow[]>(
      `SELECT store_id, customer_type, order_status FROM t_miniapp_order WHERE order_no = ? AND tenant_id = ? FOR UPDATE`,
      [orderNo, tenantId]
    );
    const order = before[0];
    if (!order) return null;

    const [res] = await conn.execute<ResultSetHeader>(
      `UPDATE t_miniapp_order SET order_status = 'ACCEPTED', updated_at = NOW() WHERE order_no = ? AND tenant_id = ?`,
      [orderNo, tenantId]
    );
    if (Number(res?.affectedRows ?? 0) === 0) return null;

    // business_status 取本事务内 UPDATE 后的真实状态（不反推）
    const [after] = await conn.execute<MiniappRetailTruthRow[]>(
      `SELECT order_status FROM t_miniapp_order WHERE order_no = ? AND tenant_id = ? LIMIT 1`,
      [orderNo, tenantId]
    );
    const realStatus = after[0]?.order_status ?? "ACCEPTED";

    await appendMiniappRetailEventIfRetail(order, {
      conn,
      tenantId,
      orderNo,
      businessStage: "ACCEPTED",
      businessStatus: realStatus,
      upstreamBizKey: `${orderNo}:ACCEPTED`,
      actorFallback: "store-accept-order",
    });

    return { orderNo, status: "ACCEPTED" };
  });
}

/**
 * 开始配送（TOTAL-ORDER-PROGRESS-03：状态 UPDATE 与操作日志合并进同一事务 + DELIVERING 事件）。
 * 语义保持：非 WAIT_DELIVERY/不可命中 ⇒ 返回 null。
 */
export async function startDelivery(orderNo: string, tenantId: string, userId: number | null, username: string) {
  return transaction(async (conn) => {
    const [before] = await conn.execute<MiniappRetailTruthRow[]>(
      `SELECT store_id, customer_type, order_status FROM t_miniapp_order WHERE order_no = ? AND tenant_id = ? FOR UPDATE`,
      [orderNo, tenantId]
    );
    const order = before[0];
    if (!order) return null;

    const [res] = await conn.execute<ResultSetHeader>(
      `UPDATE t_miniapp_order
       SET order_status = 'DELIVERING', delivery_status = 'DELIVERING', updated_at = NOW()
       WHERE order_no = ? AND order_status = 'WAIT_DELIVERY' AND tenant_id = ?`,
      [orderNo, tenantId]
    );
    if (Number(res?.affectedRows ?? 0) === 0) return null;

    await conn.execute(
      `INSERT INTO t_operation_log (operator_id, operator_name, module, action, biz_no, after_data, tenant_id)
       VALUES (?, ?, 'ORDER_DELIVERY', 'START_DELIVERY', ?, JSON_OBJECT('status', 'DELIVERING'), ?)`,
      [userId ?? null, username ?? "系统用户", orderNo, tenantId]
    );

    const [after] = await conn.execute<MiniappRetailTruthRow[]>(
      `SELECT order_status FROM t_miniapp_order WHERE order_no = ? AND tenant_id = ? LIMIT 1`,
      [orderNo, tenantId]
    );
    const realStatus = after[0]?.order_status ?? "DELIVERING";

    await appendMiniappRetailEventIfRetail(order, {
      conn,
      tenantId,
      orderNo,
      businessStage: "DELIVERING",
      businessStatus: realStatus,
      actorId: userId,
      actorType: "user",
      upstreamBizKey: `${orderNo}:START_DELIVERY`,
      actorFallback: "store-start-delivery",
    });

    return { orderNo, status: "DELIVERING" };
  });
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

    // 契约 §8.1：完成事件与库存扣减/主表状态/追溯码消费同事务（business_status 同事务读回真值）
    if (tenantId) {
      await appendMiniappRetailCompletedEvent(conn, orderNo, {
        tenantId,
        actorId: userId,
        actorType: "user",
        action: "STORE_COMPLETE",
      });
    }

    return result;
  });
}

async function releaseOrderReservation(orderNo: string, status: "REJECTED" | "CANCELLED", operatorId: number | null, tenantId: string) {
  return transaction(async (conn) => {
    const [orders] = await conn.query<OrderConnRow[]>(
      `SELECT order_no, store_id, customer_type FROM t_miniapp_order
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

    // 契约 §8.1：取消/拒收事件与状态/释放库存/流水**同一事务**，事件写失败 ⇒ 整个事务回滚（业务态不落）。
    // TOTAL-ORDER-PROGRESS-04：REJECTED 已正式加入契约 §三 miniapp_retail 阶段值域 ⇒ 拒收发正式事件
    // order.progress.miniapp_retail.rejected（不冒充 CANCELLED——两者是不同业务事实）。
    // failure_code 选型（§7.1 九码内）：DELIVERY_FAILED（适用族含 miniapp_retail，文案
    // "配送失败：{status_reason}"、下一步"联系客服重新配送"最贴近客户拒收场景），
    // needRetryEntry=true ⇒ 必带 retry_entry（§7.1 重试入口列="人工重新发货" ⇒ 动作标识 store:manual-redeliver）；
    // needManualUrl=false ⇒ manual_intervention_url 按契约为空。
    if (status === "REJECTED") {
      await appendMiniappRetailEventIfRetail(order as unknown as MiniappRetailTruthRow, {
        conn,
        tenantId,
        orderNo,
        businessStage: "REJECTED",
        businessStatus: status,
        actorId: operatorId,
        actorType: "user",
        upstreamBizKey: `${orderNo}:STORE_REJECT`,
        failureCode: "DELIVERY_FAILED",
        retryEntry: "store:manual-redeliver",
        statusReason: "客户拒收",
        actorFallback: "store-reject-order",
      });
    } else {
      await appendMiniappRetailEventIfRetail(order as unknown as MiniappRetailTruthRow, {
        conn,
        tenantId,
        orderNo,
        businessStage: "CANCELLED",
        businessStatus: status,
        actorId: operatorId,
        actorType: "user",
        upstreamBizKey: `${orderNo}:STORE_CANCEL`,
        statusReason: "订单取消释放占用库存",
        actorFallback: "store-cancel-order",
      });
    }

    return { orderNo, status };
  });
}

export async function rejectOrder(orderNo: string, operatorId: number | null, tenantId: string) {
  return releaseOrderReservation(orderNo, "REJECTED", operatorId, tenantId);
}

export async function cancelOrder(orderNo: string, operatorId: number | null, tenantId: string) {
  return releaseOrderReservation(orderNo, "CANCELLED", operatorId, tenantId);
}