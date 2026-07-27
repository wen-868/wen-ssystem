import mysql from "mysql2/promise";
import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import { calcReservation, getInitialMiniappOrderState, completeOrderDelivery, shouldReserveStock, type CustomerType } from "../../shared/fulfillment";

/** 购物车列表行（queryWithTenant 用，驼峰别名） */
interface CartItemRow {
  id: number | string;
  skuId: number | string;
  quantity: number | string;
  skuName: string;
  spuName: string;
  image: string | null;
  retailPrice: number | string | null;
  wholesalePrice: number | string | null;
  miniappPrice: number | string | null;
  availableQty: number | string;
}

/** 购物车 SKU 校验行 */
interface CartSkuRow {
  id: number | string;
  sku_name: string;
}

/** 购物车已存在项行 */
interface CartExistingRow {
  id: number | string;
  quantity: number | string;
}

/** t_user_coupon 用户优惠券查询行 */
interface UserCouponRow {
  id: number | string;
  coupon_template_id: number | string;
  status: string;
  expire_at: string | Date;
}

/** t_coupon_template 优惠券模板查询行 */
interface CouponTemplateRow {
  discount_value: number | string;
  discount_type: string;
}

/** t_full_reduction 满减活动查询行 */
interface FullReductionRow {
  id: number | string;
  rules: string | null;
  status: string;
  start_time: string | Date;
  end_time: string | Date;
}

/** 结算预览/下单购物车行（queryWithTenant 用，驼峰别名，无 id 字段） */
interface CartCheckoutRow {
  skuId: number | string;
  quantity: number | string;
  skuName: string;
  spuName: string;
  image: string | null;
  retailPrice: number | string | null;
  wholesalePrice: number | string | null;
  miniappPrice: number | string | null;
  availableQty: number | string;
}

/** 协议价查询行（t_customer_price_binding） */
interface PriceBindingRow {
  price: number | string;
}

/** 阶梯价查询行（t_sku_price） */
interface TierPriceRow {
  price: number | string;
}

/** 零售价查询行（t_product_price） */
interface RetailPriceRow {
  retail_price: number | string;
}

/** 购物车列表展示项（getCartList 返回） */
interface CartListDisplayItem {
  id: number | string;
  skuId: number | string;
  skuName: string;
  spuName: string;
  image: string | null;
  price: number;
  quantity: number;
  availableQty: number;
  subtotal: number;
  priceType: string;
}

/** 结算预览展示项（checkoutPreview 返回） */
interface CheckoutPreviewItem {
  skuId: number | string;
  skuName: string;
  spuName: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  availableQty: number;
  priceType: string;
}

/** 购物车结算行（下单时从 t_cart_item 读取，仅 skuId+quantity） */
interface CartCheckoutItemRow {
  skuId: number | string;
  quantity: number | string;
}

/** 订单项草稿（createCheckoutOrder 内部累积） */
interface OrderItemDraft {
  skuId: number | string;
  skuName: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  priceType: string;
  reservedQty: number;
  unreservedQty: number;
}

// ========== 私有辅助函数 ==========

async function getBestPrice(
  conn: mysql.PoolConnection | null,
  tenantId: string,
  customerId: number,
  skuId: number,
  quantity: number
): Promise<number> {
  const dbQuery: (sql: string, params: unknown[]) => Promise<unknown> = conn
    ? (sql, params) => conn.query(sql, params)
    : (sql, params) => queryWithTenant(sql, params, tenantId);

  // 1. 协议价
  const bindingRows = await dbQuery(
    `SELECT cpb.price FROM t_customer_price_binding cpb
     WHERE cpb.customer_id = ? AND cpb.sku_id = ? AND cpb.status = 'ACTIVE'
     ORDER BY cpb.updated_at DESC LIMIT 1`,
    [customerId, skuId]
  ) as PriceBindingRow[];
  const binding = bindingRows[0];
  if (binding) return Number(binding.price);

  // 2. 阶梯价
  const tierRows = await dbQuery(
    `SELECT sp.price FROM t_sku_price sp
     WHERE sp.sku_id = ? AND sp.min_qty <= ? AND sp.status = 1
     ORDER BY sp.min_qty DESC LIMIT 1`,
    [skuId, quantity]
  ) as TierPriceRow[];
  const tierPrice = tierRows[0];
  if (tierPrice) return Number(tierPrice.price);

  // 3. 零售价
  const retailRows = await dbQuery(
    `SELECT pp.retail_price FROM t_product_price pp WHERE pp.sku_id = ? AND pp.tenant_id = ?`,
    [skuId, tenantId]
  ) as RetailPriceRow[];
  const retail = retailRows[0];
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

  const doQueryOne = async <T = Record<string, unknown>>(sql: string, params: (string | number | null | Date | boolean)[]): Promise<T | null> => {
    if (conn) {
      const [rows] = await conn.execute(sql, params);
      return ((rows as Record<string, unknown>[])[0] ?? null) as T | null;
    }
    return queryOneWithTenant<T>(sql, params, tenantId);
  };

  // 优惠券
  if (couponId) {
    const userCoupon = await doQueryOne<UserCouponRow>(
      `SELECT uc.id, uc.coupon_template_id, uc.status, uc.expire_at
       FROM t_user_coupon uc WHERE uc.id = ? AND uc.customer_id = ? AND uc.status = 'AVAILABLE' AND uc.expire_at > NOW()`,
      [couponId, customerId]
    );
    if (userCoupon) {
      const template = await doQueryOne<CouponTemplateRow>(
        `SELECT discount_value, discount_type FROM t_coupon_template WHERE id = ?`,
        [userCoupon.coupon_template_id]
      );
      if (template) {
        discountAmount += Number(template.discount_value);
        discountDesc += `优惠券减${template.discount_value}`;
      }
    }
  }

  // 满减活动
  if (fullReductionId) {
    const fullReduction = await doQueryOne<FullReductionRow>(
      `SELECT id, rules, status, start_time, end_time FROM t_full_reduction WHERE id = ? AND status = 'ACTIVE' AND start_time <= NOW() AND end_time >= NOW()`,
      [fullReductionId]
    );
    if (fullReduction) {
      try {
        const rules: Array<{ min_amount: number; discount_amount: number }> = JSON.parse(fullReduction.rules ?? "[]");
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

// ========== 购物车 CRUD ==========

export async function getCartList(tenantId: string, customerId: number, customerType: string) {
  const rows = await queryWithTenant<CartItemRow>(
    `SELECT c.id, c.sku_id AS skuId, c.quantity,
            s.sku_name AS skuName, p.name AS spuName, p.main_image AS image,
            pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice, pp.miniapp_price AS miniappPrice,
            COALESCE(ib.available_qty, 0) AS availableQty
     FROM t_cart_item c
     JOIN t_product_sku s ON s.id = c.sku_id AND s.tenant_id = c.tenant_id
     JOIN t_product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id
     JOIN t_product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
     LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.store_id = 1 AND ib.stock_type = 'ONLINE' AND ib.tenant_id = c.tenant_id
     WHERE c.customer_id = ?
     ORDER BY c.added_at DESC`,
    [customerId],
    tenantId
  );
  const items: CartListDisplayItem[] = rows.map((row) => {
    const wholesaleVisible = shouldReserveStock(customerType as CustomerType) && row.wholesalePrice != null;
    const price = wholesaleVisible ? Number(row.wholesalePrice) : Number(row.miniappPrice ?? row.retailPrice);
    return {
      id: row.id,
      skuId: row.skuId,
      skuName: row.skuName,
      spuName: row.spuName,
      image: row.image,
      price,
      quantity: Number(row.quantity),
      availableQty: Number(row.availableQty),
      subtotal: Number((price * Number(row.quantity)).toFixed(2)),
      priceType: wholesaleVisible ? "WHOLESALE" : "RETAIL"
    };
  });
  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  return { items, totalAmount: Number(totalAmount.toFixed(2)), totalQty };
}

export async function addToCart(tenantId: string, customerId: number, skuId: number, quantity: number) {
  const sku = await queryOneWithTenant<CartSkuRow>(
    `SELECT s.id, s.sku_name FROM t_product_sku s JOIN t_product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id WHERE s.id = ? AND p.status = 'ON_SALE'`,
    [skuId],
    tenantId
  );
  if (!sku) {
    return { success: false, message: "商品不存在或已下架" };
  }

  const existing = await queryOneWithTenant<CartExistingRow>(
    `SELECT id, quantity FROM t_cart_item WHERE customer_id = ? AND sku_id = ?`,
    [customerId, skuId],
    tenantId
  );
  if (existing) {
    await queryWithTenant(
      `UPDATE t_cart_item SET quantity = quantity + ?, updated_at = NOW() WHERE id = ?`,
      [quantity, existing.id],
      tenantId
    );
  } else {
    await queryWithTenant(
      `INSERT INTO t_cart_item (customer_id, sku_id, quantity) VALUES (?, ?, ?)`,
      [customerId, skuId, quantity],
      tenantId
    );
  }
  return { success: true, message: "已加入购物车" };
}

export async function updateCartItemQuantity(tenantId: string, customerId: number, skuId: number, quantity: number) {
  if (quantity === 0) {
    await queryWithTenant(
      `DELETE FROM t_cart_item WHERE customer_id = ? AND sku_id = ?`,
      [customerId, skuId],
      tenantId
    );
    return { success: true, message: "已更新" };
  } else {
    const result = await queryWithTenant(
      `UPDATE t_cart_item SET quantity = ?, updated_at = NOW() WHERE customer_id = ? AND sku_id = ?`,
      [quantity, customerId, skuId],
      tenantId
    );
    if ((result as unknown as { affectedRows: number }).affectedRows === 0) {
      return { success: false, message: "购物车中无此商品" };
    }
    return { success: true, message: "已更新" };
  }
}

export async function deleteCartItem(tenantId: string, customerId: number, skuId: number) {
  await queryWithTenant(
    `DELETE FROM t_cart_item WHERE customer_id = ? AND sku_id = ?`,
    [customerId, skuId],
    tenantId
  );
  return { message: "已删除" };
}

export async function clearCart(tenantId: string, customerId: number) {
  await queryWithTenant(
    `DELETE FROM t_cart_item WHERE customer_id = ?`,
    [customerId],
    tenantId
  );
  return { message: "购物车已清空" };
}

export async function getCartCount(tenantId: string, customerId: number) {
  const row = await queryOneWithTenant<{ total: number }>(
    `SELECT COALESCE(SUM(quantity), 0) AS total FROM t_cart_item WHERE customer_id = ?`,
    [customerId],
    tenantId
  );
  return { count: Number(row?.total ?? 0) };
}

// ========== 结算 ==========

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

  let cartItems: CartCheckoutRow[];
  if (skuIds && skuIds.length > 0) {
    const placeholders = skuIds.map(() => "?").join(",");
    cartItems = await queryWithTenant<CartCheckoutRow>(
      `SELECT c.sku_id AS skuId, c.quantity,
              s.sku_name AS skuName, p.name AS spuName, p.main_image AS image,
              pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice, pp.miniapp_price AS miniappPrice,
              COALESCE(ib.available_qty, 0) AS availableQty
       FROM t_cart_item c
       JOIN t_product_sku s ON s.id = c.sku_id AND s.tenant_id = c.tenant_id
       JOIN t_product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id
       JOIN t_product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
       LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.store_id = ? AND ib.stock_type = 'ONLINE' AND ib.tenant_id = c.tenant_id
       WHERE c.customer_id = ? AND c.sku_id IN (${placeholders})`,
      [storeId, customerId, ...skuIds],
      tenantId
    );
  } else {
    cartItems = await queryWithTenant<CartCheckoutRow>(
      `SELECT c.sku_id AS skuId, c.quantity,
              s.sku_name AS skuName, p.name AS spuName, p.main_image AS image,
              pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice, pp.miniapp_price AS miniappPrice,
              COALESCE(ib.available_qty, 0) AS availableQty
       FROM t_cart_item c
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
  const previewItems: CheckoutPreviewItem[] = [];
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
      quantity: Number(row.quantity),
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
    let cartItems: CartCheckoutItemRow[];
    if (skuIds && skuIds.length > 0) {
      const placeholders = skuIds.map(() => "?").join(",");
      cartItems = (await conn.query(
        `SELECT sku_id AS skuId, quantity FROM t_cart_item WHERE customer_id = ? AND tenant_id = ? AND sku_id IN (${placeholders})`,
        [customerId, tenantId, ...skuIds]
      ))[0] as unknown as CartCheckoutItemRow[];
    } else {
      cartItems = (await conn.query(
        `SELECT sku_id AS skuId, quantity FROM t_cart_item WHERE customer_id = ? AND tenant_id = ?`,
        [customerId, tenantId]
      ))[0] as unknown as CartCheckoutItemRow[];
    }

    if (cartItems.length === 0) throw new Error("购物车为空");

    const orderNo = makeBizNo("DD");
    const initialState = getInitialMiniappOrderState(customerType as CustomerType);
    let goodsAmount = 0;
    const orderItems: OrderItemDraft[] = [];

    for (const cartItem of cartItems) {
      const [price] = await conn.query(
        `SELECT s.sku_name, pp.retail_price, pp.wholesale_price, pp.miniapp_price
         FROM t_product_sku s JOIN t_product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id WHERE s.id = ? AND s.tenant_id = ?`,
        [cartItem.skuId, tenantId]
      );
      const priceRow = (price as unknown as Record<string, unknown>[])[0];
      if (!priceRow) throw new Error(`SKU不存在：${cartItem.skuId}`);

      const qty = Number(cartItem.quantity);
      const unitPrice = await getBestPrice(conn, tenantId, customerId, Number(cartItem.skuId), qty);
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
        skuName: String(priceRow.sku_name),
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

    await conn.execute(
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
      await conn.execute(
        `INSERT INTO t_miniapp_order_item (order_no, sku_id, sku_name, qty, reserved_qty, unreserved_qty, unit_price, price_type, subtotal_amount, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderNo, item.skuId, item.skuName, item.qty, item.reservedQty, item.unreservedQty, item.unitPrice, item.priceType, item.subtotal, tenantId]
      );

      if (shouldReserveStock(customerType as CustomerType) && item.reservedQty > 0) {
        await conn.execute(
          `UPDATE t_inventory_balance
           SET locked_qty = locked_qty + ?, available_qty = GREATEST(available_qty - ?, 0), updated_at = NOW()
           WHERE store_id = ? AND sku_id = ? AND stock_type = 'ONLINE' AND tenant_id = ?`,
          [item.reservedQty, item.reservedQty, storeId, item.skuId, tenantId]
        );
        await conn.execute(
          `INSERT INTO t_inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
                                         change_qty, before_qty, after_qty, before_locked_qty, after_locked_qty,
                                         operator_id, idempotency_key, remark, tenant_id)
           VALUES (?, ?, ?, 'ONLINE', 'ORDER_LOCK', ?, 0, 0, 0, 0, ?, NULL, ?, ?, ?)`,
          [makeBizNo("IL"), storeId, item.skuId, orderNo, item.reservedQty, `ORDER_LOCK:${orderNo}:${item.skuId}`, "批发订货占用库存", tenantId]
        );
      }
    }

    const cartSkuIds = cartItems.map((c) => c.skuId);
    const placeholders = cartSkuIds.map(() => "?").join(",");
    await conn.execute(
      `DELETE FROM t_cart_item WHERE customer_id = ? AND tenant_id = ? AND sku_id IN (${placeholders})`,
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