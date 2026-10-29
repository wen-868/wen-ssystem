import crypto from "node:crypto";
import type { PoolConnection } from "mysql2/promise";
import { query, queryOne, transaction } from "../shared/db";
import { makeBizNo } from "../shared/id";
import { calcReservation, getInitialMiniappOrderState, completeOrderDelivery, getMemberLevelLabel, shouldReserveStock, type CustomerType } from "../shared/fulfillment";
import { updateTraceCodesBySkuList } from "../shared/trace-code";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { appendOrderProgressEvent, miniappRetailEvent, appendMiniappRetailCompletedEvent } from "../shared/order-progress-events";

// ========== 类型定义 ==========

interface MiniappProductRow {
  skuId: number;
  name: string;
  skuName: string;
  image: string | null;
  retailPrice: number | null;
  wholesalePrice: number | null;
  miniappPrice: number | null;
  availableQty: number;
}

interface SkuPriceRow {
  sku_name: string;
  retail_price: number | null;
  wholesale_price: number | null;
  miniapp_price: number | null;
}

interface InventoryBalanceRow {
  physicalQty: number;
  lockedQty: number;
  availableQty: number;
}

interface MiniappOrderRow {
  orderNo: string;
  storeId: number;
  fulfillmentType: string;
  orderStatus: string;
  payStatus: string;
  payableAmount: number;
  receiverName: string | null;
  receiverMobile: string | null;
  receiverAddress: string | null;
  createdAt: string;
}

interface CountTotalRow {
  total: number;
}

interface MiniappOrderDetailRow {
  orderNo: string;
  orderStatus: string;
  payStatus: string;
  payableAmount: number;
  expireAt: string | null;
  receiverName: string | null;
  receiverMobile: string | null;
  receiverAddress: string | null;
  fulfillmentType: string;
  createdAt: string;
}

interface MiniappOrderItemRow {
  skuId: number;
  skuName: string;
  quantity: number;
  unitPrice: number;
  subtotalAmount: number;
}

/** 创建订单时构造的内部订单项（含库存预留信息） */
interface MiniappOrderItemInternal {
  skuId: number;
  qty: number;
  skuName: string;
  unitPrice: number;
  subtotal: number;
  priceType: string;
  reservedQty: number;
  unreservedQty: number;
}

/** 确认收货时查询的 SKU ID 行 */
interface OrderItemSkuIdRow extends RowDataPacket {
  sku_id: number;
}

/** 取消订单时查询的订单行 */
interface MiniappOrderCancelRow extends RowDataPacket {
  order_no: string;
  store_id: number;
  customer_type?: string;
}

/** 支付结果查询行 */
interface PayStatusRow {
  payStatus: string;
  orderStatus?: string;
}

interface StatementOrderRow {
  orderNo: string;
  amount: number;
  date: string;
  orderStatus: string;
  payStatus: string;
}

interface StatementPaymentRow {
  paymentNo: string;
  amount: number;
  method: string;
  date: string;
  status: string;
}

interface TotalPurchaseRow {
  totalPurchase: number;
}

interface TotalPaidRow {
  totalPaid: number;
}

interface StatementDetailRow {
  orderNo: string;
  amount: number;
  date: string;
  orderStatus: string;
  payStatus: string;
  receiverName: string | null;
  receiverMobile: string | null;
  receiverAddress: string | null;
}

interface StatementItemRow {
  skuName: string;
  qty: number;
  unitPrice: number;
  subtotalAmount: number;
}

// ========== Dev Token Store ==========
export const devTokenStore = new Map<string, { memberId: number; customerType: string; createdAt: number }>();

// ========== Dev 登录 ==========
export function devLogin() {
  const token = crypto.randomBytes(32).toString("hex");
  devTokenStore.set(token, { memberId: 1, customerType: "RETAIL", createdAt: Date.now() });
  return { token, memberId: 1, customerType: "RETAIL" };
}

// ========== Dev Auth 登录 ==========
export function devAuthLogin() {
  const token = crypto.randomBytes(32).toString("hex");
  devTokenStore.set(token, { memberId: 1, customerType: "RETAIL", createdAt: Date.now() });
  return { token, memberId: 1, customerType: "RETAIL" };
}

// ========== 获取模拟用户信息 ==========
export function getProfile(customerType: string) {
  return {
    memberId: 1,
    nickname: "微信演示用户",
    mobile: "139****0001",
    customerType,
    memberLevel: getMemberLevelLabel(customerType as CustomerType),
    points: 120
  };
}

// ========== 搜索商品列表 ==========
export async function getProducts(tenantId: string, storeId: number, keyword: string, customerType: string) {
  const kw = `%${keyword}%`;
  const rows = await query<MiniappProductRow>(
    `SELECT s.id AS skuId, p.name, s.sku_name AS skuName, p.main_image AS image,
            pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice, pp.miniapp_price AS miniappPrice,
            COALESCE(ib.available_qty, 0) AS availableQty
     FROM t_product_sku s
     JOIN t_product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id
     JOIN t_product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
     LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.store_id = ? AND ib.stock_type = 'ONLINE' AND ib.tenant_id = s.tenant_id
     WHERE s.tenant_id = ? AND p.status = 'ON_SALE'
       AND (p.name LIKE ? OR s.sku_name LIKE ? OR s.sku_code LIKE ? OR s.barcode LIKE ?)
     ORDER BY p.id DESC
     LIMIT 100`,
    [storeId, tenantId, kw, kw, kw, kw]
  );

  const data = rows.map((row) => {
    const wholesaleVisible = shouldReserveStock(customerType as CustomerType) && row.wholesalePrice != null;
    const price = wholesaleVisible ? Number(row.wholesalePrice) : Number(row.miniappPrice ?? row.retailPrice);
    const item: Record<string, unknown> = {
      skuId: row.skuId,
      name: row.name,
      skuName: row.skuName,
      image: row.image,
      price,
      retailPrice: Number(row.retailPrice),
      priceType: wholesaleVisible ? "WHOLESALE" : "RETAIL",
      availableQty: Number(row.availableQty)
    };
    if (wholesaleVisible) item.wholesalePrice = Number(row.wholesalePrice);
    return item;
  });

  return data;
}

// ========== 创建订单 ==========
export async function createOrder(tenantId: string, body: {
  storeId: number; fulfillmentType: string;
  receiverName?: string; receiverMobile?: string; receiverAddress?: string;
  remark?: string;
  items: Array<{ skuId: number; qty: number }>;
}, customerType: string, anonymousMemberId: string, settlementType: string) {
  const remarkWithIdentity = anonymousMemberId
    ? `[anon:${anonymousMemberId}]${body.remark ? ` ${body.remark}` : ""}`
    : body.remark ?? null;

  const initialState = getInitialMiniappOrderState(customerType as CustomerType);

  const order = await transaction(async (conn) => {
    const orderNo = makeBizNo("DD");
    let goodsAmount = 0;
    const items: MiniappOrderItemInternal[] = [];

    for (const item of body.items) {
      const price = await queryOne<SkuPriceRow>(
        `SELECT s.sku_name, pp.retail_price, pp.wholesale_price, pp.miniapp_price
         FROM t_product_sku s JOIN t_product_price pp ON pp.sku_id = s.id WHERE s.id = ? AND s.tenant_id = ?`,
        [item.skuId, tenantId]
      );
      if (!price) throw new Error(`SKU不存在：${item.skuId}`);

      const wholesale = shouldReserveStock(customerType as CustomerType) && price.wholesale_price != null;
      const unitPrice = wholesale ? Number(price.wholesale_price) : Number(price.miniapp_price ?? price.retail_price);
      const subtotal = unitPrice * item.qty;
      goodsAmount += subtotal;

      const inventory = await queryOne<InventoryBalanceRow>(
        `SELECT physical_qty AS physicalQty, locked_qty AS lockedQty, available_qty AS availableQty
         FROM t_inventory_balance
         WHERE tenant_id = ? AND store_id = ? AND sku_id = ? AND stock_type = 'ONLINE'`,
        [tenantId, body.storeId, item.skuId]
      );

      const reservation = shouldReserveStock(customerType as CustomerType)
        ? calcReservation({ orderQty: item.qty, availableQty: Number(inventory?.availableQty ?? 0) })
        : { reservedQty: 0, unreservedQty: item.qty };

      items.push({
        ...item,
        skuName: price.sku_name,
        unitPrice,
        subtotal,
        priceType: wholesale ? "WHOLESALE" : "RETAIL",
        reservedQty: reservation.reservedQty,
        unreservedQty: reservation.unreservedQty
      });
    }

    await conn.execute(
      `INSERT INTO t_miniapp_order (order_no, member_id, store_id, customer_type, fulfillment_type, order_status, pay_status,
                                  settlement_type, delivery_status, goods_amount, payable_amount,
                                  receiver_name, receiver_mobile, receiver_address, remark, expire_at, tenant_id)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), ?)`,
      [
        orderNo,
        body.storeId,
        customerType,
        body.fulfillmentType,
        initialState.orderStatus,
        initialState.payStatus,
        settlementType,
        initialState.orderStatus === "WAIT_DELIVERY" ? "PENDING_DELIVERY" : "WAITING",
        goodsAmount,
        goodsAmount,
        body.receiverName ?? null,
        body.receiverMobile ?? null,
        body.receiverAddress ?? null,
        remarkWithIdentity,
        tenantId
      ]
    );

    for (const item of items) {
      await conn.execute(
        `INSERT INTO t_miniapp_order_item (order_no, sku_id, sku_name, qty, reserved_qty, unreserved_qty, unit_price, price_type, subtotal_amount, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderNo, item.skuId, item.skuName, item.qty, item.reservedQty, item.unreservedQty, item.unitPrice, item.priceType, item.subtotal, tenantId]
      );

      if (shouldReserveStock(customerType as CustomerType) && item.reservedQty > 0) {
        await conn.execute(
          `UPDATE t_inventory_balance
           SET locked_qty = locked_qty + ?,
               available_qty = GREATEST(available_qty - ?, 0),
               updated_at = NOW()
           WHERE tenant_id = ? AND store_id = ? AND sku_id = ? AND stock_type = 'ONLINE'`,
          [item.reservedQty, item.reservedQty, tenantId, body.storeId, item.skuId]
        );

        await conn.execute(
          `INSERT INTO t_inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
                                         change_qty, before_qty, after_qty, before_locked_qty, after_locked_qty,
                                         operator_id, idempotency_key, remark, tenant_id)
           VALUES (?, ?, ?, 'ONLINE', 'ORDER_LOCK', ?, 0, 0, 0, 0, ?, NULL, ?, ?, ?)`,
          [makeBizNo("IL"), body.storeId, item.skuId, orderNo, item.reservedQty, `ORDER_LOCK:${orderNo}:${item.skuId}`, "批发订货占用库存", tenantId]
        );
      }
    }

    // 契约 §8.1：下单事件与主表/明细/锁库同事务；写失败 ⇒ 整单回滚。
    // 仅 miniapp_retail（customer_type=RETAIL）发事件；批发单属 miniapp_wholesale 族，本卡红线不外扩。
    if (customerType === "RETAIL") {
      await appendOrderProgressEvent(conn as unknown as PoolConnection, miniappRetailEvent({
        tenantId,
        storeId: body.storeId,
        orderNo,
        businessStage: "PENDING_PAYMENT",
        businessStatus: initialState.orderStatus,
        actorType: "user",
        actorId: anonymousMemberId || null,
        upstreamBizKey: orderNo,
        statusReason: null,
        at: new Date(),
        actorFallback: "miniapp-create-order",
      }));
    }

    return {
      orderNo,
      orderStatus: initialState.orderStatus,
      payStatus: initialState.payStatus,
      payableAmount: goodsAmount,
      items: items.map((item) => ({
        skuId: item.skuId,
        quantity: item.qty,
        reservedQty: item.reservedQty,
        unreservedQty: item.unreservedQty
      }))
    };
  });

  return order;
}

// ========== 查询订单列表 ==========
export async function getOrders(tenantId: string, anonymousMemberId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;

  const records = await query<MiniappOrderRow>(
    `SELECT order_no AS orderNo, store_id AS storeId, fulfillment_type AS fulfillmentType,
            order_status AS orderStatus, pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile, receiver_address AS receiverAddress,
            created_at AS createdAt
     FROM t_miniapp_order
     WHERE tenant_id = ? AND deleted_at IS NULL AND (? = '' OR remark LIKE ?)
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, anonymousMemberId, `[anon:${anonymousMemberId}]%`, pageSize, offset]
  );

  const total = await queryOne<CountTotalRow>(
    "SELECT COUNT(*) AS total FROM t_miniapp_order WHERE tenant_id = ? AND deleted_at IS NULL AND (? = '' OR remark LIKE ?)",
    [tenantId, anonymousMemberId, `[anon:${anonymousMemberId}]%`]
  );

  return { total: total?.total ?? 0, page, pageSize, records };
}

// ========== 订单详情 ==========
export async function getOrderDetail(tenantId: string, orderNo: string, anonymousMemberId: string) {
  const order = await queryOne<MiniappOrderDetailRow>(
    `SELECT order_no AS orderNo, order_status AS orderStatus, pay_status AS payStatus,
            payable_amount AS payableAmount, expire_at AS expireAt,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            receiver_address AS receiverAddress, fulfillment_type AS fulfillmentType,
            created_at AS createdAt
     FROM t_miniapp_order WHERE order_no = ? AND tenant_id = ? AND (? = '' OR remark LIKE ?)`,
    [orderNo, tenantId, anonymousMemberId, `[anon:${anonymousMemberId}]%`]
  );

  if (!order) {
    throw Object.assign(new Error("订单不存在"), { statusCode: 404 });
  }

  const items = await query<MiniappOrderItemRow>(
    `SELECT sku_id AS skuId, sku_name AS skuName, qty AS quantity,
            unit_price AS unitPrice, subtotal_amount AS subtotalAmount
     FROM t_miniapp_order_item WHERE order_no = ? AND tenant_id = ?`,
    [orderNo, tenantId]
  );

  return { ...order, items };
}

// ========== 确认收货 ==========
export async function confirmReceipt(orderNo: string, tenantId: string) {
  const result = await transaction(async (conn) => {
    const deliveryResult = await completeOrderDelivery(conn, orderNo, null, makeBizNo);

    // R9-2: 订单完成时消费追溯码
    const [items] = await conn.query<OrderItemSkuIdRow[]>(
      `SELECT sku_id FROM t_miniapp_order_item WHERE order_no = ? AND tenant_id = ?`,
      [orderNo, tenantId]
    );
    const skuIds = items.map((it) => it.sku_id);
    if (skuIds.length > 0) {
      await updateTraceCodesBySkuList(conn, (deliveryResult as { tenantId?: string })?.tenantId || tenantId, orderNo, skuIds);
    }

    // 契约 §8.1：确认收货事件与配送完成（库存扣减/主表状态）同事务
    await appendMiniappRetailCompletedEvent(conn, orderNo, {
      tenantId,
      actorId: null,
      actorType: "user",
      action: "CONFIRM_RECEIPT",
    });

    return deliveryResult;
  });
  return result;
}

// ========== 取消订单（释放预留库存） ==========
export async function cancelOrder(orderNo: string, tenantId: string, reason?: string) {
  return transaction(async (conn) => {
    const [orders] = await conn.query<MiniappOrderCancelRow[]>(
      `SELECT order_no, store_id, customer_type FROM t_miniapp_order
       WHERE order_no = ? AND tenant_id = ?
         AND order_status IN ('PENDING_PAYMENT', 'PENDING_SHIP', 'WAIT_DELIVERY')
       FOR UPDATE`,
      [orderNo, tenantId]
    );
    const order = orders[0];
    if (!order) {
      throw Object.assign(new Error("订单不存在或当前状态不可取消"), { statusCode: 400 });
    }

    // 释放预留库存（locked_qty 回退，不扣 physical_qty）
    const [items] = await conn.query<OrderItemSkuIdRow[]>(
      `SELECT sku_id, reserved_qty FROM t_miniapp_order_item
       WHERE order_no = ? AND tenant_id = ?`,
      [orderNo, tenantId]
    );
    for (const item of items) {
      const reserved = Number((item as unknown as { reserved_qty?: number | string }).reserved_qty ?? 0);
      if (reserved <= 0) continue;
      await conn.execute(
        `UPDATE t_inventory_balance
         SET locked_qty = GREATEST(locked_qty - ?, 0), updated_at = NOW()
         WHERE store_id = ? AND sku_id = ? AND stock_type = 'ONLINE'`,
        [reserved, order.store_id, item.sku_id]
      );
    }

    await conn.execute(
      `UPDATE t_miniapp_order SET order_status = 'CANCELLED', updated_at = NOW()
       WHERE order_no = ? AND tenant_id = ?`,
      [orderNo, tenantId]
    );

    // 契约 §8.1：取消事件与状态/释放库存同事务；upstreamBizKey=orderNo:USER_CANCEL ⇒ 重复取消幂等
    // 仅 miniapp_retail 族（RETAIL）写事件；批发单属 miniapp_wholesale，本卡不外扩
    if ((order.customer_type ?? "RETAIL") === "RETAIL") {
      await appendOrderProgressEvent(conn, miniappRetailEvent({
        tenantId,
        storeId: order.store_id,
        orderNo,
        businessStage: "CANCELLED",
        businessStatus: "CANCELLED",
        actorType: "user",
        actorId: null,
        upstreamBizKey: `${orderNo}:USER_CANCEL`,
        statusReason: reason ?? "用户取消订单",
        at: new Date(),
        actorFallback: "miniapp-user-cancel",
      }));
    }

    return { orderNo, status: "CANCELLED" };
  });
}

// ========== 查询订单支付结果（真实查微信 + 同步状态） ==========
export async function queryPayResult(orderNo: string, tenantId: string) {
  const row = await queryOne<PayStatusRow>(
    `SELECT pay_status AS payStatus, order_status AS orderStatus FROM t_miniapp_order
     WHERE order_no = ? AND tenant_id = ?`,
    [orderNo, tenantId]
  );
  if (!row) {
    throw Object.assign(new Error("订单不存在"), { statusCode: 404 });
  }
  if (row.payStatus === "PAID") {
    return { paid: true, orderStatus: row.orderStatus };
  }
  // 调微信查单，成功则同步状态（前端支付成功轮询即闭环）
  try {
    const { queryWechatPayOrder } = await import("./wechat-pay.service");
    const result = await queryWechatPayOrder(tenantId, orderNo);
    if (result.trade_state === "SUCCESS") {
      await markOrderPaid(orderNo, tenantId);
      const updated = await queryOne<PayStatusRow>(
        `SELECT pay_status AS payStatus, order_status AS orderStatus FROM t_miniapp_order
         WHERE order_no = ? AND tenant_id = ?`,
        [orderNo, tenantId]
      );
      return { paid: true, orderStatus: updated?.orderStatus };
    }
    return { paid: false, orderStatus: row.orderStatus };
  } catch {
    // 微信查单失败不阻塞：返回本地状态（前端可稍后重试）
    return { paid: false, orderStatus: row.orderStatus };
  }
}

/**
 * 标记订单支付成功（幂等：仅 PENDING_PAYMENT → PENDING_SHIP 推进状态）。
 *
 * TOTAL-ORDER-PROGRESS-03：
 * - 包进 transaction() ⇒ 状态推进与 PENDING_SHIP 事件同一事务（契约 §8.1，事件失败回滚支付状态）；
 * - 事件 `upstreamBizKey = orderNo:PAID` ⇒ 重复回调（含主动查单与微信回调双入口）走 source_event_id
 *   去重，只保留一行 PENDING_SHIP（硬验收 3/7）；
 * - business_status 取**本事务内 UPDATE 后**的真实 order_status，不由阶段名反推。
 *
 * 注：`wechat-pay.service.ts` 回调入口与 `queryPayResult` 主动查单入口都收敛到本函数
 * ⇒ 事件写在内部，天然覆盖两个入口，无需扩围到回调文件（卡 §五·一.2）。
 */
export async function markOrderPaid(orderNo: string, tenantId: string) {
  await transaction(async (conn) => {
    const [orders] = await conn.execute<MarkOrderPaidRow[]>(
      `SELECT store_id, customer_type, pay_status, order_status
       FROM t_miniapp_order WHERE order_no = ? AND tenant_id = ? FOR UPDATE`,
      [orderNo, tenantId]
    );
    const before = orders[0];
    if (!before) return;

    const [res] = await conn.execute<ResultSetHeader>(
      `UPDATE t_miniapp_order SET pay_status = 'PAID', paid_at = NOW(),
              order_status = CASE WHEN order_status = 'PENDING_PAYMENT' THEN 'PENDING_SHIP' ELSE order_status END,
              updated_at = NOW()
       WHERE order_no = ? AND tenant_id = ? AND pay_status <> 'PAID'`,
      [orderNo, tenantId]
    );

    // 仅 miniapp_retail 族写事件；批发单属 miniapp_wholesale（红线 §七 不外扩）
    if (before.customer_type !== "RETAIL") return;

    let realStatus = before.order_status;
    if (Number(res?.affectedRows ?? 0) > 0) {
      const [after] = await conn.execute<{ order_status: string }[] & RowDataPacket[]>(
        `SELECT order_status FROM t_miniapp_order WHERE order_no = ? AND tenant_id = ? LIMIT 1`,
        [orderNo, tenantId]
      );
      realStatus = after[0]?.order_status ?? realStatus;
    }

    await appendOrderProgressEvent(conn, miniappRetailEvent({
      tenantId,
      storeId: before.store_id,
      orderNo,
      businessStage: "PENDING_SHIP",
      businessStatus: realStatus,
      actorType: "system",
      actorId: null,
      upstreamBizKey: `${orderNo}:PAID`,
      statusReason: null,
      at: new Date(),
      actorFallback: "miniapp-payment-paid",
    }));
  });
}

interface MarkOrderPaidRow extends RowDataPacket {
  store_id: number | string;
  customer_type: string;
  pay_status: string;
  order_status: string;
}

/** 获取订单支付人微信 openid（JSAPI 支付必需） */
export async function getOrderPayerOpenid(orderNo: string, tenantId: string): Promise<string | null> {
  const row = await queryOne<{ openid: string | null }>(
    `SELECT m.openid FROM t_miniapp_order o
     JOIN t_member m ON m.id = o.member_id AND m.tenant_id = o.tenant_id
     WHERE o.order_no = ? AND o.tenant_id = ?`,
    [orderNo, tenantId]
  );
  return row?.openid ?? null;
}

/** 按客户 ID 获取微信 openid（储值卡充值等） */
export async function getOrderPayerOpenidByCustomer(customerId: number, tenantId: string): Promise<string | null> {
  const row = await queryOne<{ openid: string | null }>(
    `SELECT openid FROM t_member WHERE id = ? AND tenant_id = ?`,
    [customerId, tenantId]
  );
  return row?.openid ?? null;
}

// ========== 订单物流（真实配送状态推导，无第三方物流则返回订单履约轨迹） ==========
export async function getOrderLogistics(orderNo: string, tenantId: string) {
  const order = await queryOne<{
    order_status: string;
    delivery_status: string | null;
    created_at: string | Date;
    paid_at: string | Date | null;
    completed_at: string | Date | null;
    cancelled_at: string | Date | null;
  }>(
    `SELECT order_status, delivery_status, created_at, paid_at, completed_at, cancelled_at
     FROM t_miniapp_order WHERE order_no = ? AND tenant_id = ? AND deleted_at IS NULL`,
    [orderNo, tenantId]
  );
  if (!order) {
    throw Object.assign(new Error("订单不存在"), { statusCode: 404 });
  }
  // 从真实订单字段推导轨迹节点（不虚构第三方物流单号）
  const traces: Array<{ time: string | Date; desc: string }> = [
    { time: order.created_at, desc: "订单已提交" },
  ];
  if (order.paid_at) traces.push({ time: order.paid_at, desc: "订单已支付" });
  if (order.order_status === "COMPLETED" && order.completed_at) {
    traces.push({ time: order.completed_at, desc: "订单已完成" });
  }
  if (order.order_status === "CANCELLED" && order.cancelled_at) {
    traces.push({ time: order.cancelled_at, desc: "订单已取消" });
  }
  const status = order.delivery_status || order.order_status;
  return {
    company: "",
    trackingNo: "",
    status,
    traces,
  };
}

// ========== 删除订单（软删，仅已取消/已完成） ==========
export async function deleteOrder(orderNo: string, tenantId: string) {
  const result = await query<ResultSetHeader>(
    `UPDATE t_miniapp_order SET deleted_at = NOW(), updated_at = NOW()
     WHERE order_no = ? AND tenant_id = ? AND order_status IN ('CANCELLED', 'COMPLETED')`,
    [orderNo, tenantId]
  );
  if (Number((result as unknown as { affectedRows?: number })?.affectedRows ?? 0) === 0) {
    throw Object.assign(new Error("订单不存在或当前状态不可删除（仅已取消/已完成）"), { statusCode: 400 });
  }
  return { orderNo, deleted: true };
}

// ========== 对账单列表 ==========
export async function getStatements(tenantId: string, anonymousMemberId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;

  const orders = await query<StatementOrderRow>(
    `SELECT order_no AS orderNo, goods_amount AS amount, created_at AS date,
            order_status AS orderStatus, pay_status AS payStatus
     FROM t_miniapp_order
     WHERE tenant_id = ? AND (? = '' OR remark LIKE ?)
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, anonymousMemberId, `[anon:${anonymousMemberId}]%`, pageSize, offset]
  );

  const payments = await query<StatementPaymentRow>(
    `SELECT pay_no AS paymentNo, amount, payment_method AS method, created_at AS date, status
     FROM t_payment_order
     WHERE tenant_id = ? AND (? = '' OR source_no IN (SELECT order_no FROM t_miniapp_order WHERE tenant_id = ? AND remark LIKE ?))
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, anonymousMemberId, tenantId, `[anon:${anonymousMemberId}]%`, pageSize, offset]
  );

  const summary = await queryOne<TotalPurchaseRow>(
    `SELECT COALESCE(SUM(goods_amount), 0) AS totalPurchase
     FROM t_miniapp_order WHERE tenant_id = ? AND (? = '' OR remark LIKE ?)`,
    [tenantId, anonymousMemberId, `[anon:${anonymousMemberId}]%`]
  );

  const paidSummary = await queryOne<TotalPaidRow>(
    `SELECT COALESCE(SUM(amount), 0) AS totalPaid
     FROM t_payment_order
     WHERE tenant_id = ? AND status = 'PAID' AND (? = '' OR source_no IN (SELECT order_no FROM t_miniapp_order WHERE tenant_id = ? AND remark LIKE ?))`,
    [tenantId, anonymousMemberId, tenantId, `[anon:${anonymousMemberId}]%`]
  );

  const totalPurchase = Number(summary?.totalPurchase || 0);
  const totalPaid = Number(paidSummary?.totalPaid || 0);
  const owingAmount = Math.max(0, totalPurchase - totalPaid);

  const orderList = orders.map((o) => ({
    id: o.orderNo,
    orderNo: o.orderNo,
    items: "",
    amount: Number(o.amount).toFixed(2),
    date: (o.date || "").slice(0, 10),
    statusText: o.payStatus === "PAID" ? "已收款" : (o.orderStatus === "CANCELLED" ? "已取消" : "未收款")
  }));

  const paymentList = payments.map((p) => ({
    id: p.paymentNo,
    paymentNo: p.paymentNo,
    method: p.method === "CASH" ? "现金" : (p.method === "OTHER_WECHAT" ? "微信支付" : p.method),
    amount: Number(p.amount).toFixed(2),
    date: (p.date || "").slice(0, 10),
    statusText: p.status === "PAID" ? "已确认" : "待确认"
  }));

  return {
    totalPurchase: totalPurchase.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    owingAmount: owingAmount.toFixed(2),
    orderList,
    paymentList
  };
}

// ========== 对账单详情 ==========
export async function getStatementDetail(tenantId: string, id: string, anonymousMemberId: string) {
  const order = await queryOne<StatementDetailRow>(
    `SELECT order_no AS orderNo, goods_amount AS amount, created_at AS date,
            order_status AS orderStatus, pay_status AS payStatus,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile, receiver_address AS receiverAddress
     FROM t_miniapp_order
     WHERE order_no = ? AND tenant_id = ? AND (? = '' OR remark LIKE ?)`,
    [id, tenantId, anonymousMemberId, `[anon:${anonymousMemberId}]%`]
  );

  if (!order) {
    throw Object.assign(new Error("对账单不存在"), { statusCode: 404 });
  }

  const items = await query<StatementItemRow>(
    `SELECT sku_name AS skuName, qty, unit_price AS unitPrice, subtotal_amount AS subtotalAmount
     FROM t_miniapp_order_item WHERE order_no = ? AND tenant_id = ?`,
    [id, tenantId]
  );

  return { ...order, items };
}
