import { Router } from "express";
import { z } from "zod";
import { requireAuthWithTenant } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok, fail } from "../shared/response.js";
import { calcReservation, getInitialMiniappOrderState } from "../shared/fulfillment.js";
import mysql from "mysql2/promise";

// ========== 购物车路由（小程序端，需认证） ==========

export const miniappCartRouter = Router();

// 获取客户ID（从认证信息中提取，不再回退到 header 防止伪造）
function getCustomerId(req: any): number {
  return Number(req.user!.id) || 1;
}

// 获取最优价格：协议价 > 阶梯价 > 零售价
async function getBestPrice(conn: mysql.PoolConnection | null, tenantId: string, customerId: number, skuId: number, quantity: number): Promise<number> {
  const dbQuery = (conn ? conn.query.bind(conn) : query) as any;

  // 1. 查协议价（customer_price_binding）
  const [bindingRows] = await dbQuery(
    `SELECT cpb.price FROM customer_price_binding cpb
     WHERE cpb.customer_id = ? AND cpb.sku_id = ? AND cpb.status = 'ACTIVE' AND cpb.tenant_id = ?
     ORDER BY cpb.updated_at DESC LIMIT 1`,
    [customerId, skuId, tenantId]
  ) as any;
  const binding = bindingRows[0];
  if (binding) return Number(binding.price);

  // 2. 查阶梯价（sku_price）：quantity >= min_qty，取最大的 min_qty 对应的价格
  const [tierRows] = await dbQuery(
    `SELECT sp.price FROM sku_price sp
     WHERE sp.sku_id = ? AND sp.min_qty <= ? AND sp.status = 1 AND sp.tenant_id = ?
     ORDER BY sp.min_qty DESC LIMIT 1`,
    [skuId, quantity, tenantId]
  ) as any;
  const tierPrice = tierRows[0];
  if (tierPrice) return Number(tierPrice.price);

  // 3. fallback 到 product_price 的 retail_price
  const [retailRows] = await dbQuery(
    `SELECT pp.retail_price FROM product_price pp WHERE pp.sku_id = ? AND pp.tenant_id = ?`,
    [skuId, tenantId]
  ) as any;
  const retail = retailRows[0];
  return retail ? Number(retail.retail_price) : 0;
}

// ---------- GET /cart - 获取购物车列表 ----------
miniappCartRouter.get("/cart", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const rows = await query<any>(
    `SELECT c.id, c.sku_id AS skuId, c.quantity,
            s.sku_name AS skuName, p.name AS spuName, p.main_image AS image,
            pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice, pp.miniapp_price AS miniappPrice,
            COALESCE(ib.available_qty, 0) AS availableQty
     FROM cart_item c
     JOIN product_sku s ON s.id = c.sku_id AND s.tenant_id = c.tenant_id
     JOIN product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id
     JOIN product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
     LEFT JOIN inventory_balance ib ON ib.sku_id = s.id AND ib.store_id = 1 AND ib.stock_type = 'ONLINE' AND ib.tenant_id = c.tenant_id
     WHERE c.customer_id = ? AND c.tenant_id = ?
     ORDER BY c.added_at DESC`,
    [customerId, tenantId]
  );
  const customerType = String(req.headers["x-customer-type"] || "RETAIL");
  const items = rows.map((row: any) => {
    const wholesaleVisible = customerType === "WHOLESALE" && row.wholesalePrice != null;
    const price = wholesaleVisible ? Number(row.wholesalePrice) : Number(row.miniappPrice ?? row.retailPrice);
    return {
      id: row.id,
      skuId: row.skuId,
      skuName: row.skuName,
      spuName: row.spuName,
      image: row.image,
      price,
      quantity: row.quantity,
      availableQty: Number(row.availableQty),
      subtotal: Number((price * row.quantity).toFixed(2)),
      priceType: wholesaleVisible ? "WHOLESALE" : "RETAIL"
    };
  });
  const totalAmount = items.reduce((sum: number, item: any) => sum + item.subtotal, 0);
  res.json(ok({ items, totalAmount: Number(totalAmount.toFixed(2)), totalQty: items.reduce((sum: number, item: any) => sum + item.quantity, 0) }));
}));

// ---------- POST /cart/add - 添加商品到购物车 ----------
miniappCartRouter.post("/cart/add", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const body = z.object({
    skuId: z.number().int().positive(),
    quantity: z.number().int().positive().default(1)
  }).parse(req.body);

  // 校验SKU是否存在
  const sku = await queryOne<any>(
    `SELECT s.id, s.sku_name FROM product_sku s JOIN product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id WHERE s.id = ? AND s.tenant_id = ? AND p.status = 'ON_SALE'`,
    [body.skuId, tenantId]
  );
  if (!sku) {
    res.status(400).json(fail("商品不存在或已下架"));
    return;
  }

  // 已存在则累加，否则插入
  const existing = await queryOne<any>(
    `SELECT id, quantity FROM cart_item WHERE customer_id = ? AND sku_id = ? AND tenant_id = ?`,
    [customerId, body.skuId, tenantId]
  );
  if (existing) {
    await query(
      `UPDATE cart_item SET quantity = quantity + ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [body.quantity, existing.id, tenantId]
    );
  } else {
    await query(
      `INSERT INTO cart_item (customer_id, sku_id, quantity, tenant_id) VALUES (?, ?, ?, ?)`,
      [customerId, body.skuId, body.quantity, tenantId]
    );
  }
  res.json(ok({ message: "已加入购物车" }));
}));

// ---------- PUT /cart/items/:skuId - 修改购物车商品数量 ----------
miniappCartRouter.put("/cart/items/:skuId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const skuId = Number(req.params.skuId);
  const body = z.object({
    quantity: z.number().int().min(0)
  }).parse(req.body);

  if (body.quantity === 0) {
    await query(`DELETE FROM cart_item WHERE customer_id = ? AND sku_id = ? AND tenant_id = ?`, [customerId, skuId, tenantId]);
  } else {
    const result = await query(
      `UPDATE cart_item SET quantity = ?, updated_at = NOW() WHERE customer_id = ? AND sku_id = ? AND tenant_id = ?`,
      [body.quantity, customerId, skuId, tenantId]
    );
    if ((result as any).affectedRows === 0) {
      res.status(404).json(fail("购物车中无此商品"));
      return;
    }
  }
  res.json(ok({ message: "已更新" }));
}));

// ---------- DELETE /cart/items/:skuId - 删除购物车商品 ----------
miniappCartRouter.delete("/cart/items/:skuId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const skuId = Number(req.params.skuId);
  await query(`DELETE FROM cart_item WHERE customer_id = ? AND sku_id = ? AND tenant_id = ?`, [customerId, skuId, tenantId]);
  res.json(ok({ message: "已删除" }));
}));

// ---------- POST /cart/clear - 清空购物车 ----------
miniappCartRouter.post("/cart/clear", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  await query(`DELETE FROM cart_item WHERE customer_id = ? AND tenant_id = ?`, [customerId, tenantId]);
  res.json(ok({ message: "购物车已清空" }));
}));

// ---------- GET /cart/count - 获取购物车商品数量 ----------
miniappCartRouter.get("/cart/count", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const row = await queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(quantity), 0) AS total FROM cart_item WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, tenantId]
  );
  res.json(ok({ count: Number(row?.total ?? 0) }));
}));

// ---------- POST /checkout/preview - 结算预览 ----------
miniappCartRouter.post("/checkout/preview", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const customerType = String(req.headers["x-customer-type"] || "RETAIL");
  const body = z.object({
    skuIds: z.array(z.number().int().positive()).optional(),
    storeId: z.number().int().positive().default(1),
    couponId: z.number().int().positive().optional(),
    fullReductionId: z.number().int().positive().optional()
  }).parse(req.body);

  // 获取购物车商品（如果指定了skuIds则只取部分）
  let cartItems: any[];
  if (body.skuIds && body.skuIds.length > 0) {
    const placeholders = body.skuIds.map(() => "?").join(",");
    cartItems = await query<any>(
      `SELECT c.sku_id AS skuId, c.quantity,
              s.sku_name AS skuName, p.name AS spuName, p.main_image AS image,
              pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice, pp.miniapp_price AS miniappPrice,
              COALESCE(ib.available_qty, 0) AS availableQty
       FROM cart_item c
       JOIN product_sku s ON s.id = c.sku_id AND s.tenant_id = c.tenant_id
       JOIN product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id
       JOIN product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
       LEFT JOIN inventory_balance ib ON ib.sku_id = s.id AND ib.store_id = ? AND ib.stock_type = 'ONLINE' AND ib.tenant_id = c.tenant_id
       WHERE c.customer_id = ? AND c.tenant_id = ? AND c.sku_id IN (${placeholders})`,
      [body.storeId, customerId, tenantId, ...body.skuIds]
    );
  } else {
    cartItems = await query<any>(
      `SELECT c.sku_id AS skuId, c.quantity,
              s.sku_name AS skuName, p.name AS spuName, p.main_image AS image,
              pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice, pp.miniapp_price AS miniappPrice,
              COALESCE(ib.available_qty, 0) AS availableQty
       FROM cart_item c
       JOIN product_sku s ON s.id = c.sku_id AND s.tenant_id = c.tenant_id
       JOIN product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id
       JOIN product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
       LEFT JOIN inventory_balance ib ON ib.sku_id = s.id AND ib.store_id = ? AND ib.stock_type = 'ONLINE' AND ib.tenant_id = c.tenant_id
       WHERE c.customer_id = ? AND c.tenant_id = ?`,
      [body.storeId, customerId, tenantId]
    );
  }

  if (cartItems.length === 0) {
    res.status(400).json(fail("购物车为空"));
    return;
  }

  let goodsAmount = 0;
  const previewItems: any[] = [];
  for (const row of cartItems) {
    const unitPrice = await getBestPrice(null, tenantId, customerId, row.skuId, row.quantity);
    const subtotal = Number((unitPrice * row.quantity).toFixed(2));
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

  // 营销优惠计算
  let discountAmount = 0;
  let discountDesc = "";

  // 优惠券
  if (body.couponId) {
    const userCoupon = await queryOne<any>(
      `SELECT uc.id, uc.coupon_template_id, uc.status, uc.expire_at
       FROM user_coupon uc WHERE uc.id = ? AND uc.customer_id = ? AND uc.tenant_id = ? AND uc.status = 'AVAILABLE' AND uc.expire_at > NOW()`,
      [body.couponId, customerId, tenantId]
    );
    if (userCoupon) {
      const template = await queryOne<{ discount_value: number; discount_type: string }>(
        `SELECT discount_value, discount_type FROM coupon_template WHERE id = ? AND tenant_id = ?`,
        [userCoupon.coupon_template_id, tenantId]
      );
      if (template) {
        discountAmount += Number(template.discount_value);
        discountDesc += (discountDesc ? " + " : "") + `优惠券减${template.discount_value}`;
      }
    }
  }

  // 满减活动
  if (body.fullReductionId) {
    const fullReduction = await queryOne<{ id: number; rules: string; status: string; start_time: string; end_time: string }>(
      `SELECT id, rules, status, start_time, end_time FROM full_reduction WHERE id = ? AND tenant_id = ? AND status = 'ACTIVE' AND start_time <= NOW() AND end_time >= NOW()`,
      [body.fullReductionId, tenantId]
    );
    if (fullReduction) {
      try {
        const rules: Array<{ min_amount: number; discount_amount: number }> = JSON.parse(fullReduction.rules);
        // 匹配最大的满足条件的满减规则
        const matched = rules
          .filter(r => goodsAmount >= r.min_amount)
          .sort((a, b) => b.min_amount - a.min_amount)[0];
        if (matched) {
          discountAmount += matched.discount_amount;
          discountDesc += (discountDesc ? " + " : "") + `满${matched.min_amount}减${matched.discount_amount}`;
        }
      } catch {
        // rules JSON 解析失败，忽略
      }
    }
  }

  // 总优惠不超过商品总额
  if (discountAmount > goodsAmount) discountAmount = goodsAmount;
  if (discountAmount === 0) discountDesc = "";

  // 运费（满99包邮）
  const shippingFee = goodsAmount >= 99 ? 0 : 10;

  const payableAmount = Number((goodsAmount - discountAmount + shippingFee).toFixed(2));

  res.json(ok({
    items: previewItems,
    goodsAmount: Number(goodsAmount.toFixed(2)),
    discountAmount,
    discountDesc,
    shippingFee,
    payableAmount,
    customerType
  }));
}));

// ---------- POST /checkout/create - 创建结算订单 ----------
miniappCartRouter.post("/checkout/create", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const customerType = String(req.headers["x-customer-type"] || "RETAIL");
  const body = z.object({
    storeId: z.number().int().positive().default(1),
    fulfillmentType: z.enum(["DELIVERY", "PICKUP"]).default("DELIVERY"),
    receiverName: z.string().optional(),
    receiverMobile: z.string().optional(),
    receiverAddress: z.string().optional(),
    remark: z.string().optional(),
    skuIds: z.array(z.number().int().positive()).optional(),
    couponId: z.number().int().positive().optional(),
    fullReductionId: z.number().int().positive().optional()
  }).parse(req.body);

  const settlementType = customerType === "WHOLESALE"
    ? String(req.headers["x-settlement-type"] || "ACCOUNT")
    : "CASH";

  const order = await transaction(async (conn) => {
    // 获取购物车商品
    let cartItems: any[];
    if (body.skuIds && body.skuIds.length > 0) {
      const placeholders = body.skuIds.map(() => "?").join(",");
      cartItems = (await conn.query(
        `SELECT sku_id AS skuId, quantity FROM cart_item WHERE customer_id = ? AND tenant_id = ? AND sku_id IN (${placeholders})`,
        [customerId, tenantId, ...body.skuIds]
      ))[0] as any[];
    } else {
      cartItems = (await conn.query(
        `SELECT sku_id AS skuId, quantity FROM cart_item WHERE customer_id = ? AND tenant_id = ?`,
        [customerId, tenantId]
      ))[0] as any[];
    }

    if (cartItems.length === 0) throw new Error("购物车为空");

    const orderNo = makeBizNo("DD");
    const initialState = getInitialMiniappOrderState(customerType === "WHOLESALE" ? "WHOLESALE" : "RETAIL");
    let goodsAmount = 0;
    const orderItems: any[] = [];

    for (const cartItem of cartItems) {
      // 获取价格快照
      const [price] = await conn.query(
        `SELECT s.sku_name, pp.retail_price, pp.wholesale_price, pp.miniapp_price
         FROM product_sku s JOIN product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id WHERE s.id = ? AND s.tenant_id = ?`,
        [cartItem.skuId, tenantId]
      );
      const priceRow = (price as any[])[0];
      if (!priceRow) throw new Error(`SKU不存在：${cartItem.skuId}`);

      // 使用阶梯价格
      const unitPrice = await getBestPrice(conn, tenantId, customerId, cartItem.skuId, cartItem.quantity);
      const qty = cartItem.quantity;
      const subtotal = Number((unitPrice * qty).toFixed(2));
      goodsAmount += subtotal;

      // 库存校验
      const [inventory] = await conn.query(
        `SELECT physical_qty AS physicalQty, locked_qty AS lockedQty, available_qty AS availableQty
         FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND stock_type = 'ONLINE' AND tenant_id = ?`,
        [body.storeId, cartItem.skuId, tenantId]
      );
      const inv = (inventory as any[])[0];
      const availableQty = Number(inv?.available_qty ?? 0);
      if (availableQty < qty && customerType === "RETAIL") {
        throw new Error(`商品 ${priceRow.sku_name} 库存不足（可售：${availableQty}）`);
      }

      const reservation = customerType === "WHOLESALE"
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

    // 营销优惠计算
    let discountAmount = 0;
    let discountDesc = "";

    // 优惠券
    if (body.couponId) {
      const [couponRows] = await conn.execute<any[]>(
        `SELECT uc.id, uc.coupon_template_id, uc.status, uc.expire_at
         FROM user_coupon uc WHERE uc.id = ? AND uc.customer_id = ? AND uc.tenant_id = ? AND uc.status = 'AVAILABLE' AND uc.expire_at > NOW()`,
        [body.couponId, customerId, tenantId]
      );
      const userCoupon = (couponRows as any[])[0];
      if (userCoupon) {
        const [tplRows] = await conn.execute<any[]>(
          `SELECT discount_value, discount_type FROM coupon_template WHERE id = ? AND tenant_id = ?`,
          [userCoupon.coupon_template_id, tenantId]
        );
        const template = (tplRows as any[])[0];
        if (template) {
          discountAmount += Number(template.discount_value);
          discountDesc += `优惠券减${template.discount_value}`;
        }
      }
    }

    // 满减活动
    if (body.fullReductionId) {
      const [frRows] = await conn.execute<any[]>(
        `SELECT id, rules, status, start_time, end_time FROM full_reduction WHERE id = ? AND tenant_id = ? AND status = 'ACTIVE' AND start_time <= NOW() AND end_time >= NOW()`,
        [body.fullReductionId, tenantId]
      );
      const fullReduction = (frRows as any[])[0];
      if (fullReduction) {
        try {
          const rules: Array<{ min_amount: number; discount_amount: number }> = JSON.parse(fullReduction.rules);
          const matched = rules
            .filter(r => goodsAmount >= r.min_amount)
            .sort((a, b) => b.min_amount - a.min_amount)[0];
          if (matched) {
            discountAmount += matched.discount_amount;
            discountDesc += (discountDesc ? " + " : "") + `满${matched.min_amount}减${matched.discount_amount}`;
          }
        } catch {
          // rules JSON 解析失败，忽略
        }
      }
    }

    // 总优惠不超过商品总额
    if (discountAmount > goodsAmount) discountAmount = goodsAmount;

    const shippingFee = goodsAmount >= 99 ? 0 : 10;
    const payableAmount = Number((goodsAmount - discountAmount + shippingFee).toFixed(2));

    // 插入订单
    await conn.execute(
      `INSERT INTO miniapp_order (order_no, member_id, store_id, customer_type, fulfillment_type, order_status, pay_status,
                                  settlement_type, delivery_status, goods_amount, discount_amount, shipping_fee, payable_amount,
                                  receiver_name, receiver_mobile, receiver_address, remark, expire_at, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), ?)`,
      [
        orderNo, customerId, body.storeId, customerType, body.fulfillmentType,
        initialState.orderStatus, initialState.payStatus, settlementType,
        initialState.orderStatus === "WAIT_DELIVERY" ? "PENDING_DELIVERY" : "WAITING",
        goodsAmount, discountAmount, shippingFee, payableAmount,
        body.receiverName ?? null, body.receiverMobile ?? null, body.receiverAddress ?? null,
        body.remark ?? null, tenantId
      ]
    );

    // 插入订单行 + 库存锁定
    for (const item of orderItems) {
      await conn.execute(
        `INSERT INTO miniapp_order_item (order_no, sku_id, sku_name, qty, reserved_qty, unreserved_qty, unit_price, price_type, subtotal_amount, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderNo, item.skuId, item.skuName, item.qty, item.reservedQty, item.unreservedQty, item.unitPrice, item.priceType, item.subtotal, tenantId]
      );

      if (customerType === "WHOLESALE" && item.reservedQty > 0) {
        await conn.execute(
          `UPDATE inventory_balance
           SET locked_qty = locked_qty + ?, available_qty = GREATEST(available_qty - ?, 0), updated_at = NOW()
           WHERE store_id = ? AND sku_id = ? AND stock_type = 'ONLINE' AND tenant_id = ?`,
          [item.reservedQty, item.reservedQty, body.storeId, item.skuId, tenantId]
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

    // 清除已购购物车商品
    const skuIds = cartItems.map((c: any) => c.skuId);
    const placeholders = skuIds.map(() => "?").join(",");
    await conn.execute(
      `DELETE FROM cart_item WHERE customer_id = ? AND tenant_id = ? AND sku_id IN (${placeholders})`,
      [customerId, tenantId, ...skuIds]
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

  res.json(ok(order));
}));
