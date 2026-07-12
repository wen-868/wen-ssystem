import mysql from "mysql2/promise";
import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import { calcReservation, getInitialMiniappOrderState, completeOrderDelivery, shouldReserveStock, type CustomerType } from "../../shared/fulfillment";
import { constants } from "../../config/constants";

async function getBestPrice(conn: mysql.PoolConnection | null, tenantId: string, customerId: number, skuId: number, quantity: number): Promise<number> {
  const dbQuery = conn ? conn.query.bind(conn) : (sql: string, params: unknown[]) => queryWithTenant(sql, params, tenantId);

  const [bindingRows] = await (dbQuery as unknown as (...args: unknown[]) => unknown)(
    `SELECT cpb.price FROM t_customer_price_binding cpb
     WHERE cpb.customer_id = ? AND cpb.sku_id = ? AND cpb.status = 'ACTIVE'
     ORDER BY cpb.updated_at DESC LIMIT 1`,
    [customerId, skuId]
  ) as unknown as unknown[][];
  const binding = (bindingRows as unknown as Record<string, unknown>[])[0];
  if (binding) return Number(binding.price);

  const [tierRows] = await (dbQuery as unknown as (...args: unknown[]) => unknown)(
    `SELECT sp.price FROM t_sku_price sp
     WHERE sp.sku_id = ? AND sp.min_qty <= ? AND sp.status = 1
     ORDER BY sp.min_qty DESC LIMIT 1`,
    [skuId, quantity]
  ) as unknown as unknown[][];
  const tierPrice = (tierRows as unknown as Record<string, unknown>[])[0];
  if (tierPrice) return Number(tierPrice.price);

  const [retailRows] = await (dbQuery as unknown as (...args: unknown[]) => unknown)(
    `SELECT pp.retail_price FROM t_product_price pp WHERE pp.sku_id = ?`,
    [skuId]
  ) as unknown as unknown[][];
  const retail = (retailRows as unknown as Record<string, unknown>[])[0];
  return retail ? Number(retail.retail_price) : 0;
}

async function calcMarketingDiscount(
  conn: mysql.PoolConnection | null,
  tenantId: string,
  customerId: number,
  goodsAmount: number,
  couponId: number | undefined,
  fullReductionId: number | undefined
): Promise<{ discountAmount: number; discountDesc: string }> {
  let discountAmount = 0;
  let discountDesc = "";

  const doQueryOne = async (sql: string, params: unknown[]) => {
    if (conn) {
      const [rows] = await (conn as any).execute(sql, params as any[]);
      return (rows as unknown as Record<string, unknown>[])[0] ?? null;
    }
    return queryOneWithTenant<Record<string, unknown>>(sql, params, tenantId);
  };

  if (couponId) {
    const userCoupon = await doQueryOne(
      `SELECT uc.id, uc.coupon_template_id, uc.status, uc.expire_at
       FROM user_coupon uc WHERE uc.id = ? AND uc.customer_id = ? AND uc.status = 'AVAILABLE' AND uc.expire_at > NOW()`,
      [couponId, customerId]
    );
    if (userCoupon) {
      const template = await doQueryOne(
        `SELECT discount_value, discount_type FROM coupon_template WHERE id = ?`,
        [userCoupon.coupon_template_id]
      );
      if (template) {
        discountAmount += Number(template.discount_value);
        discountDesc += (discountDesc ? " + " : "") + `优惠券减${template.discount_value}`;
      }
    }
  }

  if (fullReductionId) {
    const fullReduction = await doQueryOne(
      `SELECT id, rules, status, start_time, end_time FROM full_reduction WHERE id = ? AND status = 'ACTIVE' AND start_time <= NOW() AND end_time >= NOW()`,
      [fullReductionId]
    );
    if (fullReduction) {
      try {
        const rules: Array<{ min_amount: number; discount_amount: number }> = JSON.parse(String(fullReduction.rules));
        const matched = rules
          .filter(r => goodsAmount >= r.min_amount)
          .sort((a, b) => b.min_amount - a.min_amount)[0];
        if (matched) {
          discountAmount += matched.discount_amount;
          discountDesc += (discountDesc ? " + " : "") + `满${matched.min_amount}减${matched.discount_amount}`;
        }
      } catch {
        // ignore
      }
    }
  }

  if (discountAmount > goodsAmount) discountAmount = goodsAmount;
  if (discountAmount === 0) discountDesc = "";

  return { discountAmount, discountDesc };
}

export async function checkoutPreview(params: {
  tenantId: string;
  customerId: number;
  customerType: string;
  skuIds: number[] | undefined;
  storeId: number;
  couponId: number | undefined;
  fullReductionId: number | undefined;
}) {
  const { tenantId, customerId, customerType, skuIds, storeId, couponId, fullReductionId } = params;

  let cartItems: Record<string, unknown>[];
  if (skuIds && skuIds.length > 0) {
    const placeholders = skuIds.map(() => "?").join(",");
    cartItems = await queryWithTenant<Record<string, unknown>>(
      `SELECT c.sku_id AS skuId, c.quantity,
              s.sku_name AS skuName, p.name AS spuName, p.main_image AS image,
              pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice, pp.miniapp_price AS miniappPrice,
              COALESCE(ib.available_qty, 0) AS availableQty
       FROM cart_item c
       JOIN t_product_sku s ON s.id = c.sku_id AND s.tenant_id = c.tenant_id
       JOIN t_product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id
       JOIN t_product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
       LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.store_id = ? AND ib.stock_type = 'ONLINE' AND ib.tenant_id = c.tenant_id
       WHERE c.customer_id = ? AND c.sku_id IN (${placeholders})`,
      [storeId, customerId, ...skuIds],
      tenantId
    );
  } else {
    cartItems = await queryWithTenant<Record<string, unknown>>(
      `SELECT c.sku_id AS skuId, c.quantity,
              s.sku_name AS skuName, p.name AS spuName, p.main_image AS image,
              pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice, pp.miniapp_price AS miniappPrice,
              COALESCE(ib.available_qty, 0) AS availableQty
       FROM cart_item c
       JOIN t_product_sku s ON s.id = c.sku_id AND s.tenant_id = c.tenant_id
       JOIN t_product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id
       JOIN t_product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
       LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.store_id = ? AND ib.stock_type = 'ONLINE' AND ib.tenant_id = c.tenant_id
       WHERE c.customer_id = ?`,
      [storeId, customerId],
      tenantId
    );
  }

  if (cartItems.length === 0) {
    return { success: false, message: "购物车为空" };
  }

  let goodsAmount = 0;
  const previewItems: Record<string, unknown>[] = [];
  for (const row of cartItems) {
    const unitPrice = await getBestPrice(null, tenantId, customerId, Number(row.skuId), Number(row.quantity));
    const subtotal = Number((unitPrice * Number(row.quantity)).toFixed(2));
    goodsAmount += subtotal;
    previewItems.push({
      skuId: row.skuId,
      skuName: row.skuName,
      spuName: row.spuName,
      image: row.image,
      unitPrice,
      quantity: row.quantity,
      subtotal,
      availableQty: Number(row.availableQty),
      priceType: "BEST"
    });
  }

  const { discountAmount, discountDesc } = await calcMarketingDiscount(
    null, tenantId, customerId, goodsAmount, couponId, fullReductionId
  );

  const shippingFee = goodsAmount >= 99 ? 0 : 10;
  const payableAmount = Number((goodsAmount - discountAmount + shippingFee).toFixed(2));

  return {
    success: true,
    data: {
      items: previewItems,
      goodsAmount: Number(goodsAmount.toFixed(2)),
      discountAmount,
      discountDesc,
      shippingFee,
      payableAmount,
      customerType
    }
  };
}

export async function createCheckoutOrder(params: {
  tenantId: string;
  customerId: number;
  customerType: string;
  storeId: number;
  fulfillmentType: string;
  receiverName: string | undefined;
  receiverMobile: string | undefined;
  receiverAddress: string | undefined;
  remark: string | undefined;
  skuIds: number[] | undefined;
  couponId: number | undefined;
  fullReductionId: number | undefined;
  settlementType: string;
}) {
  const {
    tenantId, customerId, customerType, storeId, fulfillmentType,
    receiverName, receiverMobile, receiverAddress, remark,
    skuIds, couponId, fullReductionId, settlementType
  } = params;

  const order = await transaction(async (conn) => {
    let cartItems: Record<string, unknown>[];
    if (skuIds && skuIds.length > 0) {
      const placeholders = skuIds.map(() => "?").join(",");
      cartItems = (await conn.query(
        `SELECT sku_id AS skuId, quantity FROM cart_item WHERE customer_id = ? AND tenant_id = ? AND sku_id IN (${placeholders})`,
        [customerId, tenantId, ...skuIds]
      ))[0] as unknown as Record<string, unknown>[];
    } else {
      cartItems = (await conn.query(
        `SELECT sku_id AS skuId, quantity FROM cart_item WHERE customer_id = ? AND tenant_id = ?`,
        [customerId, tenantId]
      ))[0] as unknown as Record<string, unknown>[];
    }

    if (cartItems.length === 0) throw new Error("购物车为空");

    const orderNo = makeBizNo("DD");
    const initialState = getInitialMiniappOrderState(customerType as CustomerType);
    let goodsAmount = 0;
    const orderItems: Record<string, unknown>[] = [];

    for (const cartItem of cartItems) {
      const [price] = await conn.query(
        `SELECT s.sku_name, pp.retail_price, pp.wholesale_price, pp.miniapp_price
         FROM t_product_sku s JOIN t_product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id WHERE s.id = ? AND s.tenant_id = ?`,
        [cartItem.skuId, tenantId]
      );
      const priceRow = (price as unknown as Record<string, unknown>[])[0];
      if (!priceRow) throw new Error(`SKU不存在：${cartItem.skuId}`);

      const unitPrice = await getBestPrice(conn, tenantId, customerId, Number(cartItem.skuId), Number(cartItem.quantity));
      const qty = Number(cartItem.quantity);
      const subtotal = Number((unitPrice * qty).toFixed(2));
      goodsAmount += subtotal;

      const [inventory] = await conn.query(
        `SELECT physical_qty AS physicalQty, locked_qty AS lockedQty, available_qty AS availableQty
         FROM t_inventory_balance WHERE store_id = ? AND sku_id = ? AND stock_type = 'ONLINE' AND tenant_id = ?`,
        [storeId, cartItem.skuId, tenantId]
      );
      const inv = (inventory as unknown as Record<string, unknown>[])[0];
      const availableQty = Number(inv?.available_qty ?? 0);
      if (availableQty < qty && !shouldReserveStock(customerType as CustomerType)) {
        throw new Error(`商品 ${priceRow.sku_name} 库存不足（可售：${availableQty}）`);
      }

      const reservation = shouldReserveStock(customerType as CustomerType)
        ? calcReservation({ orderQty: qty, availableQty })
        : { reservedQty: 0, unreservedQty: qty };

      orderItems.push({
        skuId: cartItem.skuId,
        skuName: priceRow.sku_name,
        qty,
        unitPrice,
        subtotal,
        priceType: "BEST",
        reservedQty: reservation.reservedQty,
        unreservedQty: reservation.unreservedQty
      });
    }

    const { discountAmount, discountDesc } = await calcMarketingDiscount(
      conn, tenantId, customerId, goodsAmount, couponId, fullReductionId
    );

    const shippingFee = goodsAmount >= 99 ? 0 : 10;
    const payableAmount = Number((goodsAmount - discountAmount + shippingFee).toFixed(2));

    await (conn as any).execute(
      `INSERT INTO t_miniapp_order (order_no, member_id, store_id, customer_type, fulfillment_type, order_status, pay_status,
                                  settlement_type, delivery_status, goods_amount, discount_amount, shipping_fee, payable_amount,
                                  receiver_name, receiver_mobile, receiver_address, remark, expire_at, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), ?)`,
      [
        orderNo, customerId, storeId, customerType, fulfillmentType,
        initialState.orderStatus, initialState.payStatus, settlementType,
        initialState.orderStatus === "WAIT_DELIVERY" ? "PENDING_DELIVERY" : "WAITING",
        goodsAmount, discountAmount, shippingFee, payableAmount,
        receiverName ?? null, receiverMobile ?? null, receiverAddress ?? null,
        remark ?? null, tenantId
      ]
    );

    for (const item of orderItems) {
      await (conn as any).execute(
        `INSERT INTO t_miniapp_order_item (order_no, sku_id, sku_name, qty, reserved_qty, unreserved_qty, unit_price, price_type, subtotal_amount, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderNo, item.skuId, item.skuName, item.qty, item.reservedQty, item.unreservedQty, item.unitPrice, item.priceType, item.subtotal, tenantId]
      );

      if (shouldReserveStock(customerType as CustomerType) && Number(item.reservedQty) > 0) {
        await (conn as any).execute(
          `UPDATE t_inventory_balance
           SET locked_qty = locked_qty + ?, available_qty = GREATEST(available_qty - ?, 0), updated_at = NOW()
           WHERE store_id = ? AND sku_id = ? AND stock_type = 'ONLINE' AND tenant_id = ?`,
          [item.reservedQty, item.reservedQty, storeId, item.skuId, tenantId]
        );
        await (conn as any).execute(
          `INSERT INTO t_inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
                                         change_qty, before_qty, after_qty, before_locked_qty, after_locked_qty,
                                         operator_id, idempotency_key, remark, tenant_id)
           VALUES (?, ?, ?, 'ONLINE', 'ORDER_LOCK', ?, 0, 0, 0, 0, ?, NULL, ?, ?, ?)`,
          [makeBizNo("IL"), storeId, item.skuId, orderNo, item.reservedQty, `ORDER_LOCK:${orderNo}:${item.skuId}`, "批发订货占用库存", tenantId]
        );
      }
    }

    const cartSkuIds = cartItems.map((c: Record<string, unknown>) => c.skuId);
    const placeholders = cartSkuIds.map(() => "?").join(",");
    await (conn as any).execute(
      `DELETE FROM cart_item WHERE customer_id = ? AND tenant_id = ? AND sku_id IN (${placeholders})`,
      [customerId, tenantId, ...cartSkuIds]
    );

    return {
      orderNo,
      orderStatus: initialState.orderStatus,
      payStatus: initialState.payStatus,
      goodsAmount: Number(goodsAmount.toFixed(2)),
      discountAmount,
      discountDesc,
      shippingFee,
      payableAmount,
      itemCount: orderItems.length
    };
  });

  return order;
}

// ========== 配送完成（统一调用共享 completeOrderDelivery） ==========

export async function completeDelivery(orderNo: string, userId: number | null) {
  return transaction(async (conn) => {
    return completeOrderDelivery(conn, orderNo, userId ?? null, makeBizNo);
  });
}
