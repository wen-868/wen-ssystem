import { Router } from "express";
import { z } from "zod";
import { requireAuth, signToken } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { verifyPassword } from "../shared/password.js";
import { ok } from "../shared/response.js";

export const adminRouter = Router();

adminRouter.post("/auth/login", asyncHandler(async (req, res) => {
  const body = z.object({ username: z.string(), password: z.string() }).parse(req.body);
  const account = await queryOne<any>(
    "SELECT id, username, password_hash, real_name, store_id, status FROM sys_user WHERE username = ? LIMIT 1",
    [body.username]
  );
  if (!account || account.status !== 1 || !verifyPassword(body.password, account.password_hash)) {
    res.status(401).json({ code: "401", message: "账号或密码错误" });
    return;
  }
  const roles = await query<any>(
    `SELECT r.role_code
     FROM sys_user_role ur
     JOIN sys_role r ON r.id = ur.role_id
     WHERE ur.user_id = ? AND r.status = 1`,
    [account.id]
  );
  const roleCodes = roles.map((r) => r.role_code);
  const user = {
    id: account.id,
    username: account.username,
    realName: account.real_name,
    storeId: account.store_id,
    roles: roleCodes,
    permissions: ["*"]
  };
  res.json(ok({ token: signToken({ id: account.id, username: account.username, roles: roleCodes, storeId: account.store_id }), user }));
}));

adminRouter.get("/auth/me", requireAuth, (req, res) => {
  res.json(ok(req.user));
});

adminRouter.get("/staff", requireAuth, asyncHandler(async (_req, res) => {
  const records = await query<any>(
    `SELECT id AS staffId, username, real_name AS realName, store_id AS storeId, status
     FROM sys_user
     WHERE status = 1
     ORDER BY id ASC`,
    []
  );
  res.json(ok({ total: records.length, records }));
}));

adminRouter.get("/members", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const keyword = `%${String(req.query.keyword || "")}%`;
  const records = await query<any>(
    `SELECT m.id AS memberId, m.name, m.mobile, m.customer_type AS customerType,
            m.points, m.level_code AS levelCode, m.status,
            m.staff_id AS staffId, u.real_name AS staffName
     FROM member m
     LEFT JOIN sys_user u ON u.id = m.staff_id
     WHERE m.name LIKE ? OR m.mobile LIKE ?
     ORDER BY m.id DESC
     LIMIT ? OFFSET ?`,
    [keyword, keyword, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM member", []);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

adminRouter.post("/members", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string(),
    mobile: z.string(),
    customerType: z.enum(["RETAIL", "WHOLESALE"]).default("RETAIL"),
    staffId: z.number().optional()
  }).parse(req.body);
  const result = await query<any>(
    `INSERT INTO member (name, mobile, customer_type, staff_id, points, level_code, status)
     VALUES (?, ?, ?, ?, 0, ?, 1)`,
    [body.name, body.mobile, body.customerType, body.staffId ?? null, body.customerType === "WHOLESALE" ? "WHOLESALE" : "NORMAL"]
  );
  const memberId = result?.[0]?.insertId ?? Date.now();
  res.json(ok({ memberId, name: body.name, mobile: body.mobile, customerType: body.customerType, staffId: body.staffId ?? null }));
}));

adminRouter.get("/members/:memberId", requireAuth, asyncHandler(async (req, res) => {
  const member = await queryOne<any>(
    `SELECT m.id AS memberId, m.name, m.mobile, m.customer_type AS customerType,
            m.points, m.level_code AS levelCode, m.status,
            m.staff_id AS staffId, u.real_name AS staffName
     FROM member m
     LEFT JOIN sys_user u ON u.id = m.staff_id
     WHERE m.id = ?`,
    [Number(req.params.memberId)]
  );
  if (!member) {
    res.status(404).json({ code: "404", message: "客户不存在" });
    return;
  }
  res.json(ok(member));
}));

adminRouter.post("/members/:memberId/assign", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({ staffId: z.number() }).parse(req.body);
  await query("UPDATE member SET staff_id = ?, updated_at = NOW() WHERE id = ?", [body.staffId, Number(req.params.memberId)]);
  res.json(ok({ memberId: Number(req.params.memberId), staffId: body.staffId }));
}));

adminRouter.get("/members/:memberId/price-history", requireAuth, asyncHandler(async (req, res) => {
  const memberId = Number(req.params.memberId);
  const skuId = Number(req.query.skuId);
  const records = await query<any>(
    `SELECT sbi.sku_id AS skuId, sbi.sku_name AS skuName, sbi.unit_price AS unitPrice,
            sb.bill_no AS billNo, sb.created_at AS createdAt
     FROM sale_bill_item sbi
     JOIN sale_bill sb ON sb.bill_no = sbi.bill_no
     WHERE sb.customer_id = ? AND sbi.sku_id = ?
     ORDER BY sb.created_at DESC`,
    [memberId, skuId]
  );
  if (records.length === 0) {
    res.json(ok([]));
    return;
  }
  const prices = records.map((r) => Number(r.unitPrice));
  res.json(ok([{
    skuId,
    skuName: records[0].skuName,
    lastPrice: prices[0],
    highestPrice: Math.max(...prices),
    lowestPrice: Math.min(...prices),
    billCount: records.length,
    lastBillNo: records[0].billNo
  }]));
}));

adminRouter.get("/stores", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const keyword = `%${String(req.query.keyword || "")}%`;
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT id, store_code AS storeCode, name, address, contact, phone, delivery_radius AS deliveryRadius,
            business_status AS businessStatus, status
     FROM store
     WHERE name LIKE ? OR store_code LIKE ?
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [keyword, keyword, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM store WHERE name LIKE ? OR store_code LIKE ?", [keyword, keyword]);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

adminRouter.post("/stores", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string(),
    address: z.string(),
    lng: z.number().optional(),
    lat: z.number().optional(),
    contact: z.string().optional(),
    phone: z.string().optional(),
    deliveryRadius: z.number().default(3)
  }).parse(req.body);
  const storeCode = makeBizNo("MD");
  const result = await queryOne<any>(
    `SELECT 1 AS ok`
  );
  await query(
    `INSERT INTO store (store_code, name, address, lng, lat, contact, phone, delivery_radius)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [storeCode, body.name, body.address, body.lng ?? null, body.lat ?? null, body.contact ?? null, body.phone ?? null, body.deliveryRadius]
  );
  void result;
  const created = await queryOne<any>("SELECT id, store_code AS storeCode, name FROM store WHERE store_code = ?", [storeCode]);
  res.json(ok(created));
}));

adminRouter.get("/products", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const keyword = `%${String(req.query.keyword || "")}%`;
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT p.id AS spuId, s.id AS skuId, p.name, p.main_image AS mainImage, s.sku_name AS skuName, s.sku_code AS skuCode, s.barcode,
            pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice, p.status
     FROM product_sku s
     JOIN product_spu p ON p.id = s.spu_id
     JOIN product_price pp ON pp.sku_id = s.id
     WHERE p.name LIKE ? OR s.sku_code LIKE ? OR s.barcode LIKE ?
     ORDER BY p.id DESC, s.id DESC
     LIMIT ? OFFSET ?`,
    [keyword, keyword, keyword, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total
     FROM product_sku s
     JOIN product_spu p ON p.id = s.spu_id
     WHERE p.name LIKE ? OR s.sku_code LIKE ? OR s.barcode LIKE ?`,
    [keyword, keyword, keyword]
  );
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

adminRouter.post("/products", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string(),
    categoryId: z.number(),
    mainImage: z.string().optional(),
    saleChannels: z.array(z.string()).default(["MINIAPP", "STORE"]),
    skus: z.array(z.object({
      skuName: z.string(),
      barcode: z.string().optional(),
      boxRatio: z.number().default(1),
      temperature: z.enum(["NORMAL", "CHILLED"]).default("NORMAL"),
      traceEnabled: z.boolean().default(false),
      warningThreshold: z.number().default(0),
      costPrice: z.number().default(0),
      retailPrice: z.number(),
      wholesalePrice: z.number().nullable().optional(),
      miniappPrice: z.number().nullable().optional(),
      storePrice: z.number().nullable().optional()
    })).min(1)
  }).parse(req.body);
  const result = await transaction(async (conn) => {
    const spuCode = makeBizNo("SPU");
    const [spuResult] = await conn.execute<any>(
      `INSERT INTO product_spu (spu_code, name, category_id, main_image, sale_channels, status)
       VALUES (?, ?, ?, ?, CAST(? AS JSON), 'DRAFT')`,
      [spuCode, body.name, body.categoryId, body.mainImage ?? null, JSON.stringify(body.saleChannels)]
    );
    const spuId = spuResult.insertId as number;
    for (const sku of body.skus) {
      const skuCode = makeBizNo("SKU");
      const [skuResult] = await conn.execute<any>(
        `INSERT INTO product_sku (spu_id, sku_code, barcode, sku_name, box_ratio, temperature, trace_enabled, warning_threshold)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [spuId, skuCode, sku.barcode ?? null, sku.skuName, sku.boxRatio, sku.temperature, sku.traceEnabled ? 1 : 0, sku.warningThreshold]
      );
      const skuId = skuResult.insertId as number;
      await conn.execute(
        `INSERT INTO product_price (sku_id, cost_price, retail_price, wholesale_price, miniapp_price, store_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [skuId, sku.costPrice, sku.retailPrice, sku.wholesalePrice ?? null, sku.miniappPrice ?? null, sku.storePrice ?? null]
      );
    }
    return { id: spuId, spuCode };
  });
  res.json(ok(result));
}));

adminRouter.put("/products/:skuId/price", requireAuth, asyncHandler(async (req, res) => {
  const skuId = Number(req.params.skuId);
  const body = z.object({
    costPrice: z.number().optional(),
    retailPrice: z.number().optional(),
    wholesalePrice: z.number().nullable().optional(),
    miniappPrice: z.number().nullable().optional(),
    storePrice: z.number().nullable().optional()
  }).parse(req.body);
  const oldPrice = await queryOne<any>("SELECT * FROM product_price WHERE sku_id = ?", [skuId]);
  if (!oldPrice) {
    res.status(404).json({ code: "404", message: "SKU价格不存在" });
    return;
  }
  await query(
    `UPDATE product_price
     SET cost_price = COALESCE(?, cost_price),
         retail_price = COALESCE(?, retail_price),
         wholesale_price = ?,
         miniapp_price = ?,
         store_price = ?
     WHERE sku_id = ?`,
    [
      body.costPrice ?? null,
      body.retailPrice ?? null,
      body.wholesalePrice === undefined ? oldPrice.wholesale_price : body.wholesalePrice,
      body.miniappPrice === undefined ? oldPrice.miniapp_price : body.miniappPrice,
      body.storePrice === undefined ? oldPrice.store_price : body.storePrice,
      skuId
    ]
  );
  res.json(ok({ skuId }));
}));

adminRouter.get("/reports/dashboard", requireAuth, asyncHandler(async (_req, res) => {
  const sales = await queryOne<any>("SELECT COALESCE(SUM(received_amount),0) AS amount, COUNT(*) AS count FROM sale_bill WHERE DATE(created_at)=CURRENT_DATE");
  const pending = await queryOne<any>("SELECT COALESCE(SUM(unreceived_amount),0) AS amount FROM sale_bill WHERE collection_status IN ('UNPAID','PENDING','SHARED','PARTIAL')");
  const orders = await queryOne<any>("SELECT COUNT(*) AS count FROM miniapp_order WHERE DATE(created_at)=CURRENT_DATE");
  const warnings = await queryOne<any>(
    `SELECT COUNT(*) AS count
     FROM inventory_balance ib
     JOIN product_sku s ON s.id = ib.sku_id
     WHERE ib.available_qty <= s.warning_threshold`
  );
  res.json(ok({
    salesAmount: Number(sales?.amount ?? 0),
    orderCount: Number(orders?.count ?? 0),
    saleBillCount: Number(sales?.count ?? 0),
    pendingCollectionAmount: Number(pending?.amount ?? 0),
    inventoryWarningCount: Number(warnings?.count ?? 0),
    pendingOrderCount: 0
  }));
}));

adminRouter.get("/orders", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const keyword = `%${String(req.query.keyword || "")}%`;
  const status = String(req.query.status || "");
  const dateStart = String(req.query.dateStart || "");
  const dateEnd = String(req.query.dateEnd || "");
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (req.query.keyword) {
    conditions.push("(order_no LIKE ? OR receiver_name LIKE ? OR receiver_mobile LIKE ?)");
    params.push(keyword, keyword, keyword);
  }
  if (status) {
    conditions.push("order_status = ?");
    params.push(status);
  }
  if (dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(dateEnd);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const records = await query<any>(
    `SELECT order_no AS orderNo, store_id AS storeId, customer_type AS customerType,
            fulfillment_type AS fulfillmentType, order_status AS orderStatus,
            pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            created_at AS createdAt
     FROM miniapp_order ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM miniapp_order ${where}`,
    params
  );
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

adminRouter.get("/orders/export.csv", requireAuth, asyncHandler(async (req, res) => {
  const keyword = `%${String(req.query.keyword || "")}%`;
  const status = String(req.query.status || "");
  const dateStart = String(req.query.dateStart || "");
  const dateEnd = String(req.query.dateEnd || "");
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (req.query.keyword) {
    conditions.push("(order_no LIKE ? OR receiver_name LIKE ? OR receiver_mobile LIKE ?)");
    params.push(keyword, keyword, keyword);
  }
  if (status) {
    conditions.push("order_status = ?");
    params.push(status);
  }
  if (dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(dateEnd);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const records = await query<any>(
    `SELECT order_no AS orderNo, store_id AS storeId, customer_type AS customerType,
            fulfillment_type AS fulfillmentType, order_status AS orderStatus,
            pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            created_at AS createdAt
     FROM miniapp_order ${where}
     ORDER BY created_at DESC
     LIMIT 1000`,
    params
  );
  const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["订单号", "门店ID", "客户类型", "履约方式", "订单状态", "支付状态", "金额", "收货人", "手机号", "创建时间"];
  const rows = records.map((row) => [
    row.orderNo,
    row.storeId,
    row.customerType,
    row.fulfillmentType,
    row.orderStatus,
    row.payStatus,
    row.payableAmount,
    row.receiverName,
    row.receiverMobile,
    row.createdAt
  ]);
  const csv = `\uFEFF${[header, ...rows].map((line) => line.map(escapeCsv).join(",")).join("\n")}`;
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}));

adminRouter.get("/sale-bills", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_name AS customerName,
            customer_mobile AS customerMobile, receivable_amount AS receivableAmount,
            received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount,
            collection_status AS collectionStatus, business_status AS businessStatus,
            created_at AS createdAt
     FROM sale_bill
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM sale_bill");
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

adminRouter.get("/inventory/logs", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT log_no AS logNo, store_id AS storeId, sku_id AS skuId, sku_name AS skuName,
            change_qty AS changeQty, before_qty AS beforeQty, after_qty AS afterQty,
            reason, operator_name AS operatorName, created_at AS createdAt
     FROM inventory_log
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM inventory_log");
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

adminRouter.get("/collection-links", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT cl.link_no AS linkNo, cl.source_type AS sourceType, cl.source_no AS sourceNo,
            cl.amount, cl.paid_amount AS paidAmount, cl.status,
            cl.share_channel AS shareChannel, cl.token,
            cl.expire_at AS expireAt, cl.created_at AS createdAt
     FROM collection_link cl
     ORDER BY cl.created_at DESC
     LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM collection_link");
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

adminRouter.get("/payment-orders", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT pay_no AS payNo, source_type AS sourceType, source_no AS sourceNo,
            amount, status, payment_method AS paymentMethod,
            paid_at AS paidAt, created_at AS createdAt
     FROM payment_order
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM payment_order");
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

adminRouter.get("/refund-orders", requireAuth, asyncHandler(async (req, res) => {
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

adminRouter.get("/inventory/balances", requireAuth, asyncHandler(async (req, res) => {
  const records = await query<any>(
    `SELECT ib.store_id AS storeId, s.store_name AS storeName, ib.sku_id AS skuId,
            ib.sku_name AS skuName, ib.stock_type AS stockType,
            ib.physical_qty AS physicalQty, ib.available_qty AS availableQty,
            ib.locked_qty AS lockedQty
     FROM inventory_balance ib
     LEFT JOIN store s ON s.id = ib.store_id
     ORDER BY ib.store_id, ib.sku_id`
  );
  res.json(ok({ records }));
}));

adminRouter.get("/orders/:orderNo", requireAuth, asyncHandler(async (req, res) => {
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
    `SELECT sku_id AS skuId, sku_name AS skuName, quantity, unit_price AS unitPrice,
            subtotal_amount AS subtotalAmount
     FROM miniapp_order_item WHERE order_no = ?`,
    [req.params.orderNo]
  );
  res.json(ok({ ...order, items }));
}));

adminRouter.get("/reports/daily-sales", requireAuth, asyncHandler(async (_req, res) => {
  const records = await query<any>(
    `SELECT DATE(created_at) AS date,
            COUNT(DISTINCT bill_no) AS count,
            COALESCE(SUM(receivable_amount), 0) AS amount
     FROM sale_bill
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY DATE(created_at)
     ORDER BY date`
  );
  res.json(ok(records));
}));

adminRouter.get("/reports/order-stats", requireAuth, asyncHandler(async (_req, res) => {
  const records = await query<any>(
    `SELECT order_status AS status, COUNT(*) AS count
     FROM miniapp_order
     GROUP BY order_status`
  );
  res.json(ok(records));
}));

adminRouter.get("/reports/store-performance", requireAuth, asyncHandler(async (_req, res) => {
  const records = await query<any>(
    `SELECT s.id AS storeId, s.name AS storeName,
            COALESCE(SUM(sb.receivable_amount), 0) AS totalSales,
            COUNT(DISTINCT sb.bill_no) AS billCount
     FROM store s
     LEFT JOIN sale_bill sb ON sb.store_id = s.id
     GROUP BY s.id, s.name`
  );
  res.json(ok(records));
}));

adminRouter.get("/inventory/alerts", requireAuth, asyncHandler(async (_req, res) => {
  const records = await query<any>(
    `SELECT ib.store_id AS storeId, s.name AS storeName,
            ib.sku_id AS skuId, ib.sku_name AS skuName,
            ib.stock_type AS stockType, ib.available_qty AS availableQty
     FROM inventory_balance ib
     LEFT JOIN store s ON s.id = ib.store_id
     WHERE ib.available_qty <= 5
     ORDER BY ib.available_qty ASC, ib.store_id`
  );
  res.json(ok(records));
}));
