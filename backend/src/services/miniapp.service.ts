import crypto from "node:crypto";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { calcReservation, getInitialMiniappOrderState, completeOrderDelivery } from "../shared/fulfillment.js";
import { signToken, type AuthUser } from "../shared/auth.js";

// ========== Dev Token Store ==========
export const devTokenStore = new Map<string, { memberId: number; customerType: string; createdAt: number }>();

// ========== Dev 登录 ==========
export function devLogin() {
  const token = crypto.randomBytes(32).toString("hex");
  devTokenStore.set(token, { memberId: 1, customerType: "RETAIL", createdAt: Date.now() });
  return { token, memberId: 1, customerType: "RETAIL" };
}

// ========== Dev Auth 登录（返回 JWT） ==========
export function devAuthLogin() {
  const devUser: AuthUser = {
    id: 1,
    username: "miniapp_dev",
    roles: ["CUSTOMER"],
    storeId: null,
    tenantId: "default"
  };
  const token = signToken(devUser);
  return { token, memberId: 1, customerType: "RETAIL" };
}

// ========== 获取模拟用户信息 ==========
export function getProfile(customerType: string) {
  return {
    memberId: 1,
    nickname: "微信演示用户",
    mobile: "139****0001",
    customerType,
    memberLevel: customerType === "WHOLESALE" ? "批发客户" : "普通会员",
    points: 120
  };
}

// ========== 搜索商品列表 ==========
export async function getProducts(storeId: number, keyword: string, customerType: string) {
  const kw = `%${keyword}%`;
  const rows = await query<any>(
    `SELECT s.id AS skuId, p.name, s.sku_name AS skuName, p.main_image AS image,
            pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice, pp.miniapp_price AS miniappPrice,
            COALESCE(ib.available_qty, 0) AS availableQty
     FROM product_sku s
     JOIN product_spu p ON p.id = s.spu_id
     JOIN product_price pp ON pp.sku_id = s.id
     LEFT JOIN inventory_balance ib ON ib.sku_id = s.id AND ib.store_id = ? AND ib.stock_type = 'ONLINE'
     WHERE p.status = 'ON_SALE'
       AND (p.name LIKE ? OR s.sku_name LIKE ? OR s.sku_code LIKE ? OR s.barcode LIKE ?)
     ORDER BY p.id DESC
     LIMIT 100`,
    [storeId, kw, kw, kw, kw]
  );

  const data = rows.map((row: any) => {
    const wholesaleVisible = customerType === "WHOLESALE" && row.wholesalePrice != null;
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

  const initialState = getInitialMiniappOrderState(customerType === "WHOLESALE" ? "WHOLESALE" : "RETAIL");

  const order = await transaction(async (conn) => {
    const orderNo = makeBizNo("DD");
    let goodsAmount = 0;
    const items = [];

    for (const item of body.items) {
      const price = await queryOne<any>(
        `SELECT s.sku_name, pp.retail_price, pp.wholesale_price, pp.miniapp_price
         FROM product_sku s JOIN product_price pp ON pp.sku_id = s.id WHERE s.id = ? AND s.tenant_id = ?`,
        [item.skuId, tenantId]
      );
      if (!price) throw new Error(`SKU不存在：${item.skuId}`);

      const wholesale = customerType === "WHOLESALE" && price.wholesale_price != null;
      const unitPrice = wholesale ? Number(price.wholesale_price) : Number(price.miniapp_price ?? price.retail_price);
      const subtotal = unitPrice * item.qty;
      goodsAmount += subtotal;

      const inventory = await queryOne<any>(
        `SELECT physical_qty AS physicalQty, locked_qty AS lockedQty, available_qty AS availableQty
         FROM inventory_balance
         WHERE tenant_id = ? AND store_id = ? AND sku_id = ? AND stock_type = 'ONLINE'`,
        [tenantId, body.storeId, item.skuId]
      );

      const reservation = customerType === "WHOLESALE"
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
      `INSERT INTO miniapp_order (order_no, member_id, store_id, customer_type, fulfillment_type, order_status, pay_status,
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
        `INSERT INTO miniapp_order_item (order_no, sku_id, sku_name, qty, reserved_qty, unreserved_qty, unit_price, price_type, subtotal_amount, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderNo, item.skuId, item.skuName, item.qty, item.reservedQty, item.unreservedQty, item.unitPrice, item.priceType, item.subtotal, tenantId]
      );

      if (customerType === "WHOLESALE" && item.reservedQty > 0) {
        await conn.execute(
          `UPDATE inventory_balance
           SET locked_qty = locked_qty + ?,
               available_qty = GREATEST(available_qty - ?, 0),
               updated_at = NOW()
           WHERE tenant_id = ? AND store_id = ? AND sku_id = ? AND stock_type = 'ONLINE'`,
          [item.reservedQty, item.reservedQty, tenantId, body.storeId, item.skuId]
        );

        await conn.execute(
          `INSERT INTO inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
                                         change_qty, before_qty, after_qty, before_locked_qty, after_locked_qty,
                                         operator_id, idempotency_key, remark, tenant_id)
           VALUES (?, ?, ?, 'ONLINE', 'ORDER_LOCK', ?, 0, 0, 0, 0, ?, NULL, ?, ?, ?)`,
          [makeBizNo("IL"), body.storeId, item.skuId, orderNo, item.reservedQty, `ORDER_LOCK:${orderNo}:${item.skuId}`, "批发订货占用库存", tenantId]
        );
      }
    }

    return {
      orderNo,
      orderStatus: initialState.orderStatus,
      payStatus: initialState.payStatus,
      payableAmount: goodsAmount,
      items: items.map((item: any) => ({
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

  const records = await query<any>(
    `SELECT order_no AS orderNo, store_id AS storeId, fulfillment_type AS fulfillmentType,
            order_status AS orderStatus, pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile, receiver_address AS receiverAddress,
            created_at AS createdAt
     FROM miniapp_order
     WHERE tenant_id = ? AND (? = '' OR remark LIKE ?)
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, anonymousMemberId, `[anon:${anonymousMemberId}]%`, pageSize, offset]
  );

  const total = await queryOne<any>(
    "SELECT COUNT(*) AS total FROM miniapp_order WHERE tenant_id = ? AND (? = '' OR remark LIKE ?)",
    [tenantId, anonymousMemberId, `[anon:${anonymousMemberId}]%`]
  );

  return { total: total?.total ?? 0, page, pageSize, records };
}

// ========== 订单详情 ==========
export async function getOrderDetail(tenantId: string, orderNo: string, anonymousMemberId: string) {
  const order = await queryOne<any>(
    `SELECT order_no AS orderNo, order_status AS orderStatus, pay_status AS payStatus,
            payable_amount AS payableAmount, expire_at AS expireAt,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            receiver_address AS receiverAddress, fulfillment_type AS fulfillmentType,
            created_at AS createdAt
     FROM miniapp_order WHERE order_no = ? AND tenant_id = ? AND (? = '' OR remark LIKE ?)`,
    [orderNo, tenantId, anonymousMemberId, `[anon:${anonymousMemberId}]%`]
  );

  if (!order) {
    throw Object.assign(new Error("订单不存在"), { statusCode: 404 });
  }

  const items = await query<any>(
    `SELECT sku_id AS skuId, sku_name AS skuName, qty AS quantity,
            unit_price AS unitPrice, subtotal_amount AS subtotalAmount
     FROM miniapp_order_item WHERE order_no = ? AND tenant_id = ?`,
    [orderNo, tenantId]
  );

  return { ...order, items };
}

// ========== 确认收货 ==========
export async function confirmReceipt(orderNo: string, tenantId: string) {
  const result = await transaction(async (conn) => {
    return completeOrderDelivery(conn, orderNo, null, tenantId, makeBizNo);
  });
  return result;
}

// ========== 对账单列表 ==========
export async function getStatements(tenantId: string, anonymousMemberId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;

  const orders = await query<any>(
    `SELECT order_no AS orderNo, goods_amount AS amount, created_at AS date,
            order_status AS orderStatus, pay_status AS payStatus
     FROM miniapp_order
     WHERE tenant_id = ? AND (? = '' OR remark LIKE ?)
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, anonymousMemberId, `[anon:${anonymousMemberId}]%`, pageSize, offset]
  );

  const payments = await query<any>(
    `SELECT pay_no AS paymentNo, amount, payment_method AS method, created_at AS date, status
     FROM payment_order
     WHERE tenant_id = ? AND (? = '' OR source_no IN (SELECT order_no FROM miniapp_order WHERE tenant_id = ? AND remark LIKE ?))
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, anonymousMemberId, tenantId, `[anon:${anonymousMemberId}]%`, pageSize, offset]
  );

  const summary = await queryOne<any>(
    `SELECT COALESCE(SUM(goods_amount), 0) AS totalPurchase
     FROM miniapp_order WHERE tenant_id = ? AND (? = '' OR remark LIKE ?)`,
    [tenantId, anonymousMemberId, `[anon:${anonymousMemberId}]%`]
  );

  const paidSummary = await queryOne<any>(
    `SELECT COALESCE(SUM(amount), 0) AS totalPaid
     FROM payment_order
     WHERE tenant_id = ? AND status = 'PAID' AND (? = '' OR source_no IN (SELECT order_no FROM miniapp_order WHERE tenant_id = ? AND remark LIKE ?))`,
    [tenantId, anonymousMemberId, tenantId, `[anon:${anonymousMemberId}]%`]
  );

  const totalPurchase = Number(summary?.totalPurchase || 0);
  const totalPaid = Number(paidSummary?.totalPaid || 0);
  const owingAmount = Math.max(0, totalPurchase - totalPaid);

  const orderList = orders.map((o: any) => ({
    id: o.orderNo,
    orderNo: o.orderNo,
    items: "",
    amount: Number(o.amount).toFixed(2),
    date: (o.date || "").slice(0, 10),
    statusText: o.payStatus === "PAID" ? "已收款" : (o.orderStatus === "CANCELLED" ? "已取消" : "未收款")
  }));

  const paymentList = payments.map((p: any) => ({
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
  const order = await queryOne<any>(
    `SELECT order_no AS orderNo, goods_amount AS amount, created_at AS date,
            order_status AS orderStatus, pay_status AS payStatus,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile, receiver_address AS receiverAddress
     FROM miniapp_order
     WHERE order_no = ? AND tenant_id = ? AND (? = '' OR remark LIKE ?)`,
    [id, tenantId, anonymousMemberId, `[anon:${anonymousMemberId}]%`]
  );

  if (!order) {
    throw Object.assign(new Error("对账单不存在"), { statusCode: 404 });
  }

  const items = await query<any>(
    `SELECT sku_name AS skuName, qty, unit_price AS unitPrice, subtotal_amount AS subtotalAmount
     FROM miniapp_order_item WHERE order_no = ? AND tenant_id = ?`,
    [id, tenantId]
  );

  return { ...order, items };
}