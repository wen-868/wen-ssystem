import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuth } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo, makeToken } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const storeRouter = Router();
storeRouter.use(requireAuth);

storeRouter.get("/products", asyncHandler(async (req, res) => {
  const keyword = String(req.query.keyword || "");
  const barcode = String(req.query.barcode || "");
  const storeId = req.user?.storeId ?? 1;
  const records = await query<any>(
    `SELECT s.id AS skuId, s.sku_code AS skuCode, p.name AS productName, s.sku_name AS skuName,
            s.barcode, pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice,
            pp.store_price AS storePrice, ib.available_qty AS availableQty
     FROM product_sku s
     JOIN product_spu p ON p.id = s.spu_id
     JOIN product_price pp ON pp.sku_id = s.id
     LEFT JOIN inventory_balance ib ON ib.sku_id = s.id AND ib.store_id = ? AND ib.stock_type = 'OFFLINE'
     WHERE p.status = 'ON_SALE'
       AND (? = '' OR p.name LIKE ? OR s.sku_name LIKE ? OR s.sku_code LIKE ?)
       AND (? = '' OR s.barcode = ?)
     ORDER BY s.id DESC
     LIMIT 50`,
    [storeId, keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, barcode, barcode]
  );
  res.json(ok({ records }));
}));

storeRouter.get("/members", asyncHandler(async (req, res) => {
  const keyword = String(req.query.keyword || "");
  const records = await query<any>(
    `SELECT id AS memberId, name, mobile, customer_type AS customerType, status
     FROM member
     WHERE status = 1
       AND (? = '' OR name LIKE ? OR mobile LIKE ?)
     ORDER BY id DESC
     LIMIT 50`,
    [keyword, `%${keyword}%`, `%${keyword}%`]
  );
  res.json(ok({ records }));
}));

storeRouter.get("/inventory", asyncHandler(async (req, res) => {
  const keyword = `%${String(req.query.keyword || "")}%`;
  const storeId = req.query.storeId ? Number(req.query.storeId) : req.user?.storeId;
  const rows = await query<any>(
    `SELECT ib.store_id AS storeId, ib.sku_id AS skuId, s.sku_name AS skuName, ib.stock_type AS stockType,
            ib.physical_qty AS physicalQty, ib.locked_qty AS lockedQty, ib.available_qty AS availableQty
     FROM inventory_balance ib
     JOIN product_sku s ON s.id = ib.sku_id
     JOIN product_spu p ON p.id = s.spu_id
     WHERE (? IS NULL OR ib.store_id = ?)
       AND (p.name LIKE ? OR s.sku_name LIKE ? OR s.sku_code LIKE ? OR s.barcode LIKE ?)
     ORDER BY ib.available_qty ASC, ib.updated_at DESC
     LIMIT 100`,
    [storeId ?? null, storeId ?? null, keyword, keyword, keyword, keyword]
  );
  res.json(ok(rows));
}));

storeRouter.get("/orders", asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const storeId = req.user?.storeId ?? null;
  const status = req.query.status ? String(req.query.status) : null;
  const records = await query<any>(
    `SELECT order_no AS orderNo, store_id AS storeId, fulfillment_type AS fulfillmentType,
            order_status AS orderStatus, pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile, receiver_address AS receiverAddress,
            created_at AS createdAt
     FROM miniapp_order
     WHERE (? IS NULL OR store_id = ?)
       AND (? IS NULL OR order_status = ?)
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [storeId, storeId, status, status, pageSize, offset]
  );
  const total = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM miniapp_order
     WHERE (? IS NULL OR store_id = ?)
       AND (? IS NULL OR order_status = ?)`,
    [storeId, storeId, status, status]
  );
  res.json(ok({ total: total?.total ?? 0, page, pageSize, records }));
}));

storeRouter.post("/orders/:orderNo/accept", asyncHandler(async (req, res) => {
  await query(
    `UPDATE miniapp_order SET order_status = 'ACCEPTED', updated_at = NOW() WHERE order_no = ?`,
    [req.params.orderNo]
  );
  res.json(ok({ orderNo: req.params.orderNo, status: "ACCEPTED" }));
}));

storeRouter.post("/orders/:orderNo/complete", asyncHandler(async (req, res) => {
  await query(
    `UPDATE miniapp_order SET order_status = 'COMPLETED', completed_at = NOW(), updated_at = NOW() WHERE order_no = ?`,
    [req.params.orderNo]
  );
  res.json(ok({ orderNo: req.params.orderNo, status: "COMPLETED" }));
}));

storeRouter.get("/orders/:orderNo", asyncHandler(async (req, res) => {
  const order = await queryOne<any>(
    `SELECT order_no AS orderNo, store_id AS storeId, customer_type AS customerType,
            fulfillment_type AS fulfillmentType, order_status AS orderStatus,
            pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            receiver_address AS receiverAddress, created_at AS createdAt
     FROM miniapp_order WHERE order_no = ?`,
    [req.params.orderNo]
  );
  if (!order) { res.status(404).json({ code: "404", message: "订单不存在" }); return; }
  const items = await query<any>(
    `SELECT sku_id AS skuId, sku_name AS skuName, qty AS quantity, unit_price AS unitPrice,
            subtotal_amount AS subtotalAmount
     FROM miniapp_order_item WHERE order_no = ?`,
    [req.params.orderNo]
  );
  res.json(ok({ ...order, items }));
}));

storeRouter.get("/sale-bills", asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const keyword = `%${String(req.query.keyword || "")}%`;
  const collectionStatus = req.query.collectionStatus ? String(req.query.collectionStatus) : null;
  const storeId = req.user?.storeId ?? null;
  const records = await query<any>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_id AS customerId, customer_name AS customerName,
            customer_type AS customerType, business_status AS businessStatus, collection_status AS collectionStatus,
            receivable_amount AS receivableAmount, received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount,
            created_at AS createdAt
     FROM sale_bill
     WHERE (? IS NULL OR store_id = ?)
       AND (? IS NULL OR collection_status = ?)
       AND (bill_no LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ?)
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [storeId, storeId, collectionStatus, collectionStatus, keyword, keyword, keyword, pageSize, offset]
  );
  const total = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM sale_bill
     WHERE (? IS NULL OR store_id = ?)
       AND (? IS NULL OR collection_status = ?)
       AND (bill_no LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ?)`,
    [storeId, storeId, collectionStatus, collectionStatus, keyword, keyword, keyword]
  );
  res.json(ok({ total: total?.total ?? 0, page, pageSize, records }));
}));

storeRouter.post("/sale-bills", asyncHandler(async (req, res) => {
  const body = z.object({
    storeId: z.number().optional(),
    customerId: z.number().nullable().optional(),
    customerName: z.string().optional(),
    customerMobile: z.string().optional(),
    discountAmount: z.number().default(0),
    roundingAmount: z.number().default(0),
    remark: z.string().optional(),
    internalRemark: z.string().optional(),
    items: z.array(z.object({
      skuId: z.number(),
      boxQty: z.number().default(0),
      bottleQty: z.number().default(0),
      totalBottleQty: z.number(),
      unitPrice: z.number().optional(),
      priceType: z.enum(["RETAIL", "WHOLESALE", "STORE"]).optional()
    })).min(1)
  }).parse(req.body);
  const bill = await transaction(async (conn) => {
    const billNo = makeBizNo("XS");
    const storeId = body.storeId ?? req.user?.storeId ?? 1;
    const member = body.customerId
      ? await queryOne<any>("SELECT id, name, mobile, customer_type FROM member WHERE id = ?", [body.customerId])
      : null;
    let goodsAmount = 0;
    const itemSnapshots = [];
    for (const item of body.items) {
      const price = await queryOne<any>(
        `SELECT s.sku_name, pp.retail_price, pp.wholesale_price, pp.store_price
         FROM product_sku s JOIN product_price pp ON pp.sku_id = s.id
         WHERE s.id = ?`,
        [item.skuId]
      );
      if (!price) throw new Error(`SKU不存在：${item.skuId}`);
      const customerType = member?.customer_type ?? "RETAIL";
      const computedPrice = item.unitPrice ?? (item.priceType === "WHOLESALE" || customerType === "WHOLESALE"
        ? Number(price.wholesale_price ?? price.retail_price)
        : Number(price.store_price ?? price.retail_price));
      const subtotal = computedPrice * item.totalBottleQty;
      goodsAmount += subtotal;
      itemSnapshots.push({ ...item, skuName: price.sku_name, unitPrice: computedPrice, subtotalAmount: subtotal, priceType: item.priceType ?? (customerType === "WHOLESALE" ? "WHOLESALE" : "STORE") });
    }
    const receivableAmount = Math.max(0, goodsAmount - body.discountAmount - body.roundingAmount);
    await conn.execute(
      `INSERT INTO sale_bill (bill_no, store_id, customer_id, customer_name, customer_mobile, customer_type,
                              business_status, collection_status, goods_amount, discount_amount, rounding_amount,
                              receivable_amount, received_amount, unreceived_amount, operator_id, remark, internal_remark)
       VALUES (?, ?, ?, ?, ?, ?, 'CREATED', 'UNPAID', ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        billNo, storeId, body.customerId ?? null, member?.name ?? body.customerName ?? null, member?.mobile ?? body.customerMobile ?? null,
        member?.customer_type ?? "RETAIL", goodsAmount, body.discountAmount, body.roundingAmount, receivableAmount, receivableAmount,
        req.user?.id ?? 0, body.remark ?? null, body.internalRemark ?? null
      ]
    );
    for (const item of itemSnapshots) {
      await conn.execute(
        `INSERT INTO sale_bill_item (bill_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty, unit_price, price_type, subtotal_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [billNo, item.skuId, item.skuName, item.boxQty, item.bottleQty, item.totalBottleQty, item.unitPrice, item.priceType, item.subtotalAmount]
      );
    }
    return { billNo, storeId, businessStatus: "CREATED", collectionStatus: "UNPAID", receivableAmount, receivedAmount: 0, unreceivedAmount: receivableAmount, items: itemSnapshots };
  });
  res.json(ok(bill));
}));

storeRouter.get("/sale-bills/:billNo", asyncHandler(async (req, res) => {
  const bill = await queryOne<any>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_id AS customerId, customer_name AS customerName,
            customer_type AS customerType, business_status AS businessStatus, collection_status AS collectionStatus,
            receivable_amount AS receivableAmount, received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount
     FROM sale_bill WHERE bill_no = ?`,
    [req.params.billNo]
  );
  if (!bill) {
    res.status(404).json({ code: "404", message: "销售单不存在" });
    return;
  }
  const items = await query<any>(
    `SELECT sku_id AS skuId, sku_name AS skuName, box_qty AS boxQty, bottle_qty AS bottleQty,
            total_bottle_qty AS totalBottleQty, unit_price AS unitPrice, subtotal_amount AS subtotalAmount
     FROM sale_bill_item WHERE bill_no = ?`,
    [req.params.billNo]
  );
  res.json(ok({ ...bill, items }));
}));

storeRouter.post("/sale-bills/:billNo/collection-link", asyncHandler(async (req, res) => {
  const body = z.object({
    shareChannel: z.enum(["MINIAPP_CARD", "LINK", "IMAGE", "QR_CODE"]).default("LINK"),
    amount: z.number(),
    taxEnabled: z.boolean().default(false),
    taxRate: z.number().min(0).max(1).default(0),
    expireHours: z.number().default(72),
    remark: z.string().optional()
  }).parse(req.body);
  const bill = await queryOne<any>("SELECT bill_no, unreceived_amount FROM sale_bill WHERE bill_no = ?", [req.params.billNo]);
  if (!bill) {
    res.status(404).json({ code: "404", message: "销售单不存在" });
    return;
  }
  if (body.amount <= 0 || body.amount > Number(bill.unreceived_amount)) {
    res.status(400).json({ code: "400", message: "收款金额必须大于0且不能超过未收金额" });
    return;
  }
  const linkNo = makeBizNo("SK");
  const token = makeToken();
  const taxAmount = body.taxEnabled ? Number((body.amount * body.taxRate).toFixed(2)) : 0;
  await query(
    `INSERT INTO collection_link (link_no, source_type, source_no, amount, paid_amount, status, share_channel, share_user_id, expire_at, token, tax_enabled, tax_rate, tax_amount)
     VALUES (?, 'SALE_BILL', ?, ?, 0, 'PENDING', ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?, ?, ?, ?)`,
    [linkNo, req.params.billNo, body.amount, body.shareChannel, req.user?.id ?? 0, body.expireHours, token, body.taxEnabled ? 1 : 0, body.taxRate, taxAmount]
  );
  await query(
    `UPDATE sale_bill
     SET collection_status = 'SHARED', share_collection_count = share_collection_count + 1, last_share_time = NOW(), locked_amount_flag = 1
     WHERE bill_no = ?`,
    [req.params.billNo]
  );
  res.json(ok({
    linkNo,
    sourceType: "SALE_BILL",
    sourceNo: req.params.billNo,
    amount: body.amount,
    taxEnabled: body.taxEnabled,
    taxRate: body.taxRate,
    taxAmount,
    paidAmount: 0,
    status: "PENDING",
    shareUrl: `/share/collections/${token}`,
    token
  }));
}));

storeRouter.post("/sale-bills/:billNo/offline-payment", asyncHandler(async (req, res) => {
  const body = z.object({
    amount: z.number(),
    paymentMethod: z.enum(["CASH", "TRANSFER", "OTHER_WECHAT", "ALIPAY"]),
    remark: z.string().optional()
  }).parse(req.body);
  await transaction(async (conn) => {
    const [rows] = await conn.query<any[]>("SELECT received_amount, receivable_amount FROM sale_bill WHERE bill_no = ? FOR UPDATE", [req.params.billNo]);
    const bill = rows[0];
    if (!bill) throw new Error("销售单不存在");
    const received = Number(bill.received_amount) + body.amount;
    const receivable = Number(bill.receivable_amount);
    const status = received >= receivable ? "PAID" : "PARTIAL";
    await conn.execute(
      `UPDATE sale_bill SET received_amount = ?, unreceived_amount = GREATEST(receivable_amount - ?, 0), collection_status = ?, last_payment_time = NOW()
       WHERE bill_no = ?`,
      [received, received, status, req.params.billNo]
    );
    await conn.execute(
      `INSERT INTO payment_order (pay_no, source_type, source_no, channel, amount, status, paid_at)
       VALUES (?, 'SALE_BILL', ?, ?, ?, 'SUCCESS', NOW())`,
      [makeBizNo("ZF"), req.params.billNo, body.paymentMethod, body.amount]
    );
  });
  res.json(ok({ billNo: req.params.billNo }));
}));

storeRouter.post("/inventory/adjust", asyncHandler(async (req, res) => {
  const body = z.object({
    storeId: z.number().optional(),
    skuId: z.number(),
    stockType: z.enum(["ONLINE", "OFFLINE"]).default("OFFLINE"),
    change: z.number(),
    remark: z.string().optional()
  }).parse(req.body);
  const storeId = body.storeId ?? req.user?.storeId ?? 1;
  const current = await queryOne<any>(
    `SELECT physical_qty AS physicalQty
     FROM inventory_balance
     WHERE store_id = ? AND sku_id = ? AND stock_type = ?`,
    [storeId, body.skuId, body.stockType]
  );
  const beforeQty = Number(current?.physicalQty ?? 0);
  await query(
    `UPDATE inventory_balance
     SET physical_qty = physical_qty + ?,
         available_qty = available_qty + ?,
         updated_at = NOW()
     WHERE store_id = ? AND sku_id = ? AND stock_type = ?`,
    [body.change, body.change, storeId, body.skuId, body.stockType]
  );
  const afterQty = beforeQty + body.change;
  await query(
    `INSERT INTO inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
                                   change_qty, before_qty, after_qty, before_locked_qty, after_locked_qty,
                                   operator_id, idempotency_key, remark)
     VALUES (?, ?, ?, ?, 'ADJUST', ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
    [
      makeBizNo("IL"),
      storeId,
      body.skuId,
      body.stockType,
      makeBizNo("ADJ"),
      body.change,
      beforeQty,
      afterQty,
      req.user?.id ?? null,
      makeBizNo("IDEMP"),
      body.remark ?? "门店调整"
    ]
  );
  res.json(ok({ ok: true }));
}));

storeRouter.get("/inventory/logs", asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const storeId = req.query.storeId ? Number(req.query.storeId) : req.user?.storeId;
  let sql = `SELECT il.ledger_no AS logNo, il.store_id AS storeId, il.sku_id AS skuId,
                    ps.sku_name AS skuName, il.change_qty AS changeQty,
                    il.before_qty AS beforeQty, il.after_qty AS afterQty,
                    il.remark AS reason, il.operator_id AS operatorId, il.created_at AS createdAt
             FROM inventory_ledger il
             LEFT JOIN product_sku ps ON ps.id = il.sku_id`;
  const params: unknown[] = [];
  if (storeId) {
    sql += " WHERE il.store_id = ?";
    params.push(storeId);
  }
  sql += " ORDER BY il.created_at DESC LIMIT ? OFFSET ?";
  params.push(pageSize, offset);
  const records = await query<any>(sql, params);
  const totalSql = storeId
    ? "SELECT COUNT(*) AS total FROM inventory_ledger WHERE store_id = ?"
    : "SELECT COUNT(*) AS total FROM inventory_ledger";
  const totalRow = await queryOne<any>(totalSql, storeId ? [storeId] : []);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

storeRouter.get("/collection-links", asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT link_no AS linkNo, source_type AS sourceType, source_no AS sourceNo,
            amount, paid_amount AS paidAmount, status,
            share_channel AS shareChannel, token, expire_at AS expireAt,
            created_at AS createdAt
     FROM collection_link
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM collection_link");
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

storeRouter.get("/payment-orders", asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT pay_no AS payNo, source_type AS sourceType, source_no AS sourceNo,
            amount, status, channel AS paymentMethod,
            paid_at AS paidAt, created_at AS createdAt
     FROM payment_order
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM payment_order");
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

storeRouter.post("/hold-orders", asyncHandler(async (req, res) => {
  const body = z.object({
    customerName: z.string().optional().default(""),
    customerMobile: z.string().optional().default(""),
    amount: z.number().default(0),
    remark: z.string().optional().default(""),
    items: z.array(z.object({
      skuId: z.number(),
      skuName: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      subtotalAmount: z.number()
    })).default([])
  }).parse(req.body);
  const holdNo = makeBizNo("GD");
  const storeId = req.user?.storeId ?? 1;
  const payload = JSON.stringify(body);
  await query(
    `INSERT INTO hold_order (hold_no, store_id, customer_name, customer_mobile, amount, payload, remark, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'HELD')`,
    [holdNo, storeId, body.customerName, body.customerMobile, body.amount, payload, body.remark]
  );
  res.json(ok({ holdNo, status: "HELD" }));
}));

storeRouter.get("/hold-orders", asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT hold_no AS holdNo, store_id AS storeId, customer_name AS customerName,
            customer_mobile AS customerMobile, amount, remark, status, created_at AS createdAt
     FROM hold_order
     WHERE status = 'HELD'
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM hold_order WHERE status = 'HELD'");
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

storeRouter.post("/hold-orders/:holdNo/restore", asyncHandler(async (req, res) => {
  const hold = await queryOne<any>(
    `SELECT hold_no AS holdNo, customer_name AS customerName, customer_mobile AS customerMobile,
            amount, payload, remark, status, created_at AS createdAt
     FROM hold_order
     WHERE hold_no = ? AND status = 'HELD'`,
    [req.params.holdNo]
  );
  if (!hold) {
    res.status(404).json({ code: "404", message: "挂单不存在" });
    return;
  }
  const payload = typeof hold.payload === "string" ? JSON.parse(hold.payload) : hold.payload;
  res.json(ok({ ...hold, ...payload }));
}));

storeRouter.delete("/hold-orders/:holdNo", asyncHandler(async (req, res) => {
  await query(
    `UPDATE hold_order SET status = 'DELETED', updated_at = NOW() WHERE hold_no = ?`,
    [req.params.holdNo]
  );
  res.json(ok({ holdNo: req.params.holdNo, status: "DELETED" }));
}));

storeRouter.get("/refund-orders", asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT refund_no AS refundNo, pay_no AS payNo, source_type AS sourceType,
            source_no AS sourceNo, amount, reason, status, created_at AS createdAt
     FROM refund_order
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM refund_order");
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

storeRouter.get("/dashboard", asyncHandler(async (req, res) => {
  const storeId = req.query.storeId ? Number(req.query.storeId) : req.user?.storeId ?? null;
  const whereStore = storeId ? "WHERE store_id = ?" : "";
  const params = storeId ? [storeId] : [];
  const todayOrders = await queryOne<any>(
    `SELECT COUNT(*) AS cnt FROM miniapp_order ${whereStore}`,
    params
  );
  const pendingOrders = await queryOne<any>(
    `SELECT COUNT(*) AS cnt FROM miniapp_order ${whereStore ? whereStore + " AND" : "WHERE"} order_status = 'PENDING_PAYMENT'`,
    params
  );
  const todaySales = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS total FROM sale_bill ${whereStore}`,
    params
  );
  const unreceived = await queryOne<any>(
    `SELECT COALESCE(SUM(unreceived_amount), 0) AS total FROM sale_bill ${whereStore}`,
    params
  );
  res.json(ok({
    todayOrderCount: todayOrders?.cnt ?? 0,
    pendingOrderCount: pendingOrders?.cnt ?? 0,
    todaySalesAmount: todaySales?.total ?? 0,
    unReceivedAmount: unreceived?.total ?? 0,
    storeId
  }));
}));

storeRouter.get("/daily-sales", asyncHandler(async (req, res) => {
  const storeId = req.query.storeId ? Number(req.query.storeId) : req.user?.storeId ?? null;
  const where = storeId ? "WHERE sb.store_id = ?" : "";
  const params = storeId ? [storeId] : [];
  const records = await query<any>(
    `SELECT DATE(sb.created_at) AS date, COUNT(*) AS count, COALESCE(SUM(sb.receivable_amount), 0) AS amount
     FROM sale_bill sb
     ${where}
     GROUP BY DATE(sb.created_at)
     ORDER BY date DESC
     LIMIT 7`,
    params
  );
  res.json(ok(records.reverse()));
}));

storeRouter.get("/inventory/alerts", asyncHandler(async (req, res) => {
  const storeId = req.query.storeId ? Number(req.query.storeId) : req.user?.storeId ?? null;
  const where = storeId ? "WHERE ib.store_id = ?" : "";
  const params = storeId ? [storeId] : [];
  const records = await query<any>(
    `SELECT ib.sku_id AS skuId, ps.sku_name AS skuName,
            ib.stock_type AS stockType, ib.available_qty AS availableQty
     FROM inventory_balance ib
     LEFT JOIN product_sku ps ON ps.id = ib.sku_id
     ${where ? where + " AND" : "WHERE"} ib.available_qty <= 5
     ORDER BY ib.available_qty ASC
     LIMIT 20`,
    params
  );
  res.json(ok(records));
}));
