import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const miniappRouter = Router();

miniappRouter.post("/login", (_req, res) => {
  res.json(ok({ token: "miniapp-dev-token", memberId: 1, customerType: "RETAIL" }));
});

miniappRouter.post("/auth/login", (_req, res) => {
  res.json(ok({ token: "miniapp-dev-token", memberId: 1, customerType: "RETAIL" }));
});

miniappRouter.get("/profile", (req, res) => {
  const customerType = String(req.headers["x-customer-type"] || "RETAIL");
  res.json(ok({
    memberId: 1,
    nickname: "微信演示用户",
    mobile: "139****0001",
    customerType,
    memberLevel: customerType === "WHOLESALE" ? "批发客户" : "普通会员",
    points: 120
  }));
});

miniappRouter.get("/products", asyncHandler(async (req, res) => {
  const storeId = Number(req.query.storeId || 1);
  const keyword = `%${String(req.query.keyword || "")}%`;
  const customerType = String(req.headers["x-customer-type"] || "RETAIL");
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
    [storeId, keyword, keyword, keyword, keyword]
  );
  const data = rows.map((row) => {
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
  res.json(ok(data));
}));

miniappRouter.post("/orders", asyncHandler(async (req, res) => {
  const body = z.object({
    storeId: z.number(),
    fulfillmentType: z.enum(["DELIVERY", "PICKUP"]),
    receiverName: z.string().optional(),
    receiverMobile: z.string().optional(),
    receiverAddress: z.string().optional(),
    remark: z.string().optional(),
    items: z.array(z.object({ skuId: z.number(), qty: z.number().int().positive() })).min(1)
  }).parse(req.body);
  const customerType = String(req.headers["x-customer-type"] || "RETAIL");
  const order = await transaction(async (conn) => {
    const orderNo = makeBizNo("DD");
    let goodsAmount = 0;
    const items = [];
    for (const item of body.items) {
      const price = await queryOne<any>(
        `SELECT s.sku_name, pp.retail_price, pp.wholesale_price, pp.miniapp_price
         FROM product_sku s JOIN product_price pp ON pp.sku_id = s.id WHERE s.id = ?`,
        [item.skuId]
      );
      if (!price) throw new Error(`SKU不存在：${item.skuId}`);
      const wholesale = customerType === "WHOLESALE" && price.wholesale_price != null;
      const unitPrice = wholesale ? Number(price.wholesale_price) : Number(price.miniapp_price ?? price.retail_price);
      const subtotal = unitPrice * item.qty;
      goodsAmount += subtotal;
      items.push({ ...item, skuName: price.sku_name, unitPrice, subtotal, priceType: wholesale ? "WHOLESALE" : "RETAIL" });
    }
    await conn.execute(
      `INSERT INTO miniapp_order (order_no, member_id, store_id, customer_type, fulfillment_type, order_status, pay_status,
                                  goods_amount, payable_amount, receiver_name, receiver_mobile, receiver_address, remark, expire_at)
       VALUES (?, 1, ?, ?, ?, 'PENDING_PAYMENT', 'UNPAID', ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
      [orderNo, body.storeId, customerType, body.fulfillmentType, goodsAmount, goodsAmount, body.receiverName ?? null, body.receiverMobile ?? null, body.receiverAddress ?? null, body.remark ?? null]
    );
    for (const item of items) {
      await conn.execute(
        `INSERT INTO miniapp_order_item (order_no, sku_id, sku_name, qty, unit_price, price_type, subtotal_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderNo, item.skuId, item.skuName, item.qty, item.unitPrice, item.priceType, item.subtotal]
      );
    }
    return { orderNo, orderStatus: "PENDING_PAYMENT", payStatus: "UNPAID", payableAmount: goodsAmount };
  });
  res.json(ok(order));
}));

miniappRouter.get("/orders", asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT order_no AS orderNo, store_id AS storeId, fulfillment_type AS fulfillmentType,
            order_status AS orderStatus, pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile, receiver_address AS receiverAddress,
            created_at AS createdAt
     FROM miniapp_order
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  const total = await queryOne<any>("SELECT COUNT(*) AS total FROM miniapp_order", []);
  res.json(ok({ total: total?.total ?? 0, page, pageSize, records }));
}));

miniappRouter.get("/orders/:orderNo", asyncHandler(async (req, res) => {
  const order = await queryOne<any>(
    `SELECT order_no AS orderNo, order_status AS orderStatus, pay_status AS payStatus,
            payable_amount AS payableAmount, expire_at AS expireAt,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            receiver_address AS receiverAddress, fulfillment_type AS fulfillmentType,
            created_at AS createdAt
     FROM miniapp_order WHERE order_no = ?`,
    [req.params.orderNo]
  );
  if (!order) {
    res.status(404).json({ code: "404", message: "订单不存在" });
    return;
  }
  const items = await query<any>(
    `SELECT sku_id AS skuId, sku_name AS skuName, qty AS quantity,
            unit_price AS unitPrice, subtotal_amount AS subtotalAmount
     FROM miniapp_order_item WHERE order_no = ?`,
    [req.params.orderNo]
  );
  res.json(ok({ ...order, items }));
}));
