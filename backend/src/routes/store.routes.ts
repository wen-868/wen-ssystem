import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuth, requireAuthWithTenant, signToken, getUserAccessInfo } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo, makeToken } from "../shared/id.js";
import { verifyPassword } from "../shared/password.js";
import { ok } from "../shared/response.js";
import { completeOrderDelivery } from "../shared/fulfillment.js";

export const storeRouter = Router();

storeRouter.post("/auth/login", asyncHandler(async (req, res) => {
  const body = z.object({ username: z.string(), password: z.string() }).parse(req.body);
  const account = await queryOne<any>(
    "SELECT id, username, password_hash, real_name, store_id, status, tenant_id FROM sys_user WHERE username = ? LIMIT 1",
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
     WHERE ur.user_id = ? AND r.status = 'ACTIVE'`,
    [account.id]
  );
  const roleCodes = roles.map((r: any) => r.role_code);
  const tenantId = account.tenant_id || 'default';
  const authUser = {
    id: account.id,
    username: account.username,
    realName: account.real_name,
    roles: roleCodes.length > 0 ? roleCodes : ["STAFF"],
    storeId: account.store_id,
    tenantId
  };
  const accessInfo = getUserAccessInfo(authUser);
  const user = {
    id: account.id,
    username: account.username,
    realName: account.real_name || account.username,
    roles: authUser.roles,
    storeId: account.store_id ?? 1,
    tenantId,
    ...accessInfo
  };
  const token = signToken(authUser);
  res.json(ok({ token, user }));
}));

// 当前用户信息
storeRouter.get("/me", asyncHandler(async (req, res) => {
  res.json(ok({
    userId: req.user!.id,
    realName: req.user!.username ?? "商家用户",
    storeId: req.user?.storeId ?? 1,
    role: req.user?.roles?.[0] ?? "STAFF",
    permissions: [
      "dashboard.view",
      "order.view",
      "order.deliver",
      "order.complete",
      "inventory.view",
      "customer.view",
      "receivable.view",
      "report.view"
    ],
    menus: ["home", "orders", "inventory", "customers", "receivables", "reports", "profile"]
  }));
}));

storeRouter.use(requireAuthWithTenant);

// 门店信息（供小程序端获取）
storeRouter.get("/info", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = req.user?.storeId ?? 1;
  const store = await queryOne<any>(
    `SELECT name, address, phone, contact,
            miniapp_appid AS miniappAppid, wx_merchant_name AS wxMerchantName,
            wx_service_phone AS wxServicePhone, wx_head_img AS wxHeadImg, wx_qrcode_url AS wxQrcodeUrl
     FROM store WHERE id = ? AND tenant_id = ?`,
    [storeId, tenantId]
  );
  if (!store) {
    res.status(404).json({ code: "1", message: "门店不存在" });
    return;
  }
  res.json(ok({
    storeName: store.name,
    storeAddress: store.address,
    storePhone: store.phone,
    storeContact: store.contact,
    miniappAppid: store.miniappAppid,
    wxMerchantName: store.wxMerchantName,
    wxServicePhone: store.wxServicePhone,
    wxHeadImg: store.wxHeadImg,
    wxQrcodeUrl: store.wxQrcodeUrl
  }));
}));

const rawStoreSaleBillItemSchema = z.object({
  skuId: z.number(),
  boxQty: z.number().optional(),
  bottleQty: z.number().optional(),
  quantity: z.number().optional(),
  totalBottleQty: z.number().optional(),
  unitPrice: z.number().optional(),
  priceType: z.enum(["RETAIL", "WHOLESALE", "STORE"]).optional()
});

export const storeSaleBillItemSchema = rawStoreSaleBillItemSchema.transform((item, ctx) => {
  const totalBottleQty = item.totalBottleQty ?? item.quantity;
  if (totalBottleQty == null || totalBottleQty <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "totalBottleQty 或 quantity 必须大于 0"
    });
    return z.NEVER;
  }
  return {
    skuId: item.skuId,
    boxQty: item.boxQty ?? 0,
    bottleQty: item.bottleQty ?? item.quantity ?? totalBottleQty,
    totalBottleQty,
    unitPrice: item.unitPrice,
    priceType: item.priceType
  };
});

export function normalizeStoreSaleBillItem(input: unknown) {
  return storeSaleBillItemSchema.parse(input);
}

storeRouter.get("/products", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const keyword = String(req.query.keyword || "");
  const barcode = String(req.query.barcode || "");
  const storeId = req.user?.storeId ?? 1;
  const records = await query<any>(
    `SELECT s.id AS skuId, s.sku_code AS skuCode, p.name AS productName, s.sku_name AS skuName,
            s.barcode, pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice,
            pp.store_price AS storePrice, ib.available_qty AS availableQty
     FROM product_sku s
     JOIN product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id
     JOIN product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
     LEFT JOIN inventory_balance ib ON ib.sku_id = s.id AND ib.store_id = ? AND ib.stock_type = 'OFFLINE' AND ib.tenant_id = s.tenant_id
     WHERE s.tenant_id = ?
       AND p.status = 'ON_SALE'
       AND (? = '' OR p.name LIKE ? OR s.sku_name LIKE ? OR s.sku_code LIKE ?)
       AND (? = '' OR s.barcode = ?)
     ORDER BY s.id DESC
     LIMIT 50`,
    [storeId, tenantId, keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, barcode, barcode]
  );
  res.json(ok({ records }));
}));

storeRouter.get("/members", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const keyword = String(req.query.keyword || "");
  const records = await query<any>(
    `SELECT id AS memberId, name, mobile, customer_type AS customerType, status
     FROM member
     WHERE tenant_id = ?
       AND status = 1
       AND (? = '' OR name LIKE ? OR mobile LIKE ?)
     ORDER BY id DESC
     LIMIT 50`,
    [tenantId, keyword, `%${keyword}%`, `%${keyword}%`]
  );
  res.json(ok({ records }));
}));

storeRouter.get("/inventory", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const keyword = `%${String(req.query.keyword || "")}%`;
  const storeId = req.query.storeId ? Number(req.query.storeId) : req.user?.storeId;
  const rows = await query<any>(
    `SELECT ib.store_id AS storeId, ib.sku_id AS skuId, s.sku_name AS skuName, ib.stock_type AS stockType,
            ib.physical_qty AS physicalQty, ib.locked_qty AS lockedQty, ib.available_qty AS availableQty
     FROM inventory_balance ib
     JOIN product_sku s ON s.id = ib.sku_id AND s.tenant_id = ib.tenant_id
     JOIN product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id
     WHERE ib.tenant_id = ?
       AND (? IS NULL OR ib.store_id = ?)
       AND (p.name LIKE ? OR s.sku_name LIKE ? OR s.sku_code LIKE ? OR s.barcode LIKE ?)
     ORDER BY ib.available_qty ASC, ib.updated_at DESC
     LIMIT 100`,
    [tenantId, storeId ?? null, storeId ?? null, keyword, keyword, keyword, keyword]
  );
  res.json(ok(rows));
}));

storeRouter.get("/orders", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
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
     WHERE tenant_id = ?
       AND (? IS NULL OR store_id = ?)
       AND (? IS NULL OR order_status = ?)
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, storeId, storeId, status, status, pageSize, offset]
  );
  const total = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM miniapp_order
     WHERE tenant_id = ?
       AND (? IS NULL OR store_id = ?)
       AND (? IS NULL OR order_status = ?)`,
    [tenantId, storeId, storeId, status, status]
  );
  res.json(ok({ total: total?.total ?? 0, page, pageSize, records }));
}));

storeRouter.post("/orders/:orderNo/accept", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await query(
    `UPDATE miniapp_order SET order_status = 'ACCEPTED', updated_at = NOW() WHERE order_no = ? AND tenant_id = ?`,
    [req.params.orderNo, tenantId]
  );
  if (!result || (result as any).affectedRows === 0) {
    res.status(404).json({ code: "404", message: "订单不存在" });
    return;
  }
  res.json(ok({ orderNo: req.params.orderNo, status: "ACCEPTED" }));
}));

storeRouter.post("/orders/:orderNo/start-delivery", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await query(
    `UPDATE miniapp_order
     SET order_status = 'DELIVERING', delivery_status = 'DELIVERING', updated_at = NOW()
     WHERE order_no = ? AND order_status = 'WAIT_DELIVERY' AND tenant_id = ?`,
    [req.params.orderNo, tenantId]
  );
  if (!result || (result as any).affectedRows === 0) {
    res.status(400).json({ code: "400", message: "订单不存在或状态不允许开始配送" });
    return;
  }
  await query(
    `INSERT INTO operation_log (operator_id, operator_name, module, action, biz_no, after_data, tenant_id)
     VALUES (?, ?, 'ORDER_DELIVERY', 'START_DELIVERY', ?, JSON_OBJECT('status', 'DELIVERING'), ?)`,
    [req.user!.id ?? null, req.user!.username ?? "系统用户", req.params.orderNo, tenantId]
  );
  res.json(ok({ orderNo: req.params.orderNo, status: "DELIVERING" }));
}));

storeRouter.post("/orders/:orderNo/complete-delivery", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await transaction(async (conn) => {
    return completeOrderDelivery(conn, req.params.orderNo, req.user!.id ?? null, makeBizNo);
  });
  res.json(ok(result));
}));

async function releaseOrderReservation(orderNo: string, status: "REJECTED" | "CANCELLED", operatorId: number | null, tenantId: string) {
  return transaction(async (conn) => {
    const [orders] = await conn.query<any[]>(
      `SELECT order_no, store_id FROM miniapp_order
       WHERE order_no = ? AND order_status IN ('WAIT_DELIVERY', 'DELIVERING') AND tenant_id = ?
       FOR UPDATE`,
      [orderNo, tenantId]
    );
    const order = orders[0];
    if (!order) throw new Error("订单不存在或状态不可释放库存");
    const [items] = await conn.query<any[]>(
      `SELECT sku_id AS skuId, reserved_qty AS reservedQty FROM miniapp_order_item WHERE order_no = ?`,
      [orderNo]
    );
    for (const item of items) {
      const qty = Number(item.reservedQty ?? 0);
      if (qty <= 0) continue;
      await conn.execute(
        `UPDATE inventory_balance
         SET locked_qty = GREATEST(locked_qty - ?, 0),
             available_qty = available_qty + ?,
             updated_at = NOW()
         WHERE store_id = ? AND sku_id = ? AND stock_type = 'ONLINE' AND tenant_id = ?`,
        [qty, qty, order.store_id, item.skuId, tenantId]
      );
      await conn.execute(
        `INSERT INTO inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
                                       change_qty, before_qty, after_qty, before_locked_qty, after_locked_qty,
                                       operator_id, idempotency_key, remark, tenant_id)
         VALUES (?, ?, ?, 'ONLINE', ?, ?, 0, 0, 0, 0, 0, ?, ?, ?, ?)`,
        [
          makeBizNo("IL"),
          order.store_id,
          item.skuId,
          status === "REJECTED" ? "ORDER_REJECT" : "ORDER_CANCEL",
          orderNo,
          operatorId,
          `${status}:${orderNo}:${item.skuId}`,
          status === "REJECTED" ? "客户拒收释放占用库存" : "订单取消释放占用库存",
          tenantId
        ]
      );
    }
    await conn.execute(
      `UPDATE miniapp_order
       SET order_status = ?, delivery_status = ?, updated_at = NOW()
       WHERE order_no = ? AND tenant_id = ?`,
      [status, status, orderNo, tenantId]
    );
    return { orderNo, status };
  });
}

storeRouter.post("/orders/:orderNo/reject", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  res.json(ok(await releaseOrderReservation(req.params.orderNo, "REJECTED", req.user!.id ?? null, tenantId)));
}));

storeRouter.post("/orders/:orderNo/cancel", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  res.json(ok(await releaseOrderReservation(req.params.orderNo, "CANCELLED", req.user!.id ?? null, tenantId)));
}));

storeRouter.get("/orders/:orderNo", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const order = await queryOne<any>(
    `SELECT order_no AS orderNo, store_id AS storeId, customer_type AS customerType,
            fulfillment_type AS fulfillmentType, order_status AS orderStatus,
            pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            receiver_address AS receiverAddress, created_at AS createdAt
     FROM miniapp_order WHERE order_no = ? AND tenant_id = ?`,
    [req.params.orderNo, tenantId]
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
  const tenantId = req.tenantId!;
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
     WHERE tenant_id = ?
       AND (? IS NULL OR store_id = ?)
       AND (? IS NULL OR collection_status = ?)
       AND (bill_no LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ?)
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, storeId, storeId, collectionStatus, collectionStatus, keyword, keyword, keyword, pageSize, offset]
  );
  const total = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM sale_bill
     WHERE tenant_id = ?
       AND (? IS NULL OR store_id = ?)
       AND (? IS NULL OR collection_status = ?)
       AND (bill_no LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ?)`,
    [tenantId, storeId, storeId, collectionStatus, collectionStatus, keyword, keyword, keyword]
  );
  res.json(ok({ total: total?.total ?? 0, page, pageSize, records }));
}));

storeRouter.post("/sale-bills", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    storeId: z.number().optional(),
    customerId: z.number().nullable().optional(),
    customerName: z.string().optional(),
    customerMobile: z.string().optional(),
    discountAmount: z.number().default(0),
    roundingAmount: z.number().default(0),
    remark: z.string().optional(),
    internalRemark: z.string().optional(),
    saleType: z.enum(["CASH", "CREDIT"]).default("CASH"),
    dueDate: z.string().optional(),
    items: z.array(storeSaleBillItemSchema).min(1)
  }).parse(req.body);
  const bill = await transaction(async (conn) => {
    const billNo = makeBizNo("XS");
    const storeId = body.storeId ?? req.user?.storeId ?? 1;
    const member = body.customerId
      ? await queryOne<any>("SELECT id, name, mobile, customer_type FROM member WHERE id = ? AND tenant_id = ?", [body.customerId, tenantId])
      : null;
    let goodsAmount = 0;
    const itemSnapshots = [];
    for (const item of body.items) {
      const price = await queryOne<any>(
        `SELECT s.sku_name, pp.retail_price, pp.wholesale_price, pp.store_price
         FROM product_sku s JOIN product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
         WHERE s.id = ? AND s.tenant_id = ?`,
        [item.skuId, tenantId]
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
                              sale_type, business_status, collection_status, goods_amount, discount_amount, rounding_amount,
                              receivable_amount, received_amount, unreceived_amount, due_date, operator_id, remark, internal_remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'CREATED', 'UNPAID', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [
        billNo, storeId, body.customerId ?? null, member?.name ?? body.customerName ?? null, member?.mobile ?? body.customerMobile ?? null,
        member?.customer_type ?? "RETAIL", body.saleType, goodsAmount, body.discountAmount, body.roundingAmount, receivableAmount, receivableAmount,
        body.saleType === "CREDIT" ? body.dueDate ?? null : null,
        req.user!.id ?? 0, body.remark ?? null, body.internalRemark ?? null, tenantId
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
  const tenantId = req.tenantId!;
  const bill = await queryOne<any>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_id AS customerId, customer_name AS customerName,
            customer_type AS customerType, business_status AS businessStatus, collection_status AS collectionStatus,
            receivable_amount AS receivableAmount, received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount
     FROM sale_bill WHERE bill_no = ? AND tenant_id = ?`,
    [req.params.billNo, tenantId]
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
  const tenantId = req.tenantId!;
  const body = z.object({
    shareChannel: z.enum(["MINIAPP_CARD", "LINK", "IMAGE", "QR_CODE"]).default("LINK"),
    amount: z.number(),
    taxEnabled: z.boolean().default(false),
    taxRate: z.number().min(0).max(1).default(0),
    expireHours: z.number().default(72),
    remark: z.string().optional()
  }).parse(req.body);
  const bill = await queryOne<any>("SELECT bill_no, unreceived_amount FROM sale_bill WHERE bill_no = ? AND tenant_id = ?", [req.params.billNo, tenantId]);
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
    `INSERT INTO collection_link (link_no, source_type, source_no, amount, paid_amount, status, share_channel, share_user_id, expire_at, token, tax_enabled, tax_rate, tax_amount, tenant_id)
     VALUES (?, 'SALE_BILL', ?, ?, 0, 'PENDING', ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?, ?, ?, ?, ?)`,
    [linkNo, req.params.billNo, body.amount, body.shareChannel, req.user!.id ?? 0, body.expireHours, token, body.taxEnabled ? 1 : 0, body.taxRate, taxAmount, tenantId]
  );
  await query(
    `UPDATE sale_bill
     SET collection_status = 'SHARED', share_collection_count = share_collection_count + 1, last_share_time = NOW(), locked_amount_flag = 1
     WHERE bill_no = ? AND tenant_id = ?`,
    [req.params.billNo, tenantId]
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
  const tenantId = req.tenantId!;
  const body = z.object({
    amount: z.number(),
    paymentMethod: z.enum(["CASH", "TRANSFER", "OTHER_WECHAT", "ALIPAY"]),
    remark: z.string().optional()
  }).parse(req.body);
  await transaction(async (conn) => {
    const [rows] = await conn.query<any[]>(
      "SELECT bill_no, store_id, received_amount, receivable_amount, collection_status FROM sale_bill WHERE bill_no = ? AND tenant_id = ? FOR UPDATE",
      [req.params.billNo, tenantId]
    );
    const bill = rows[0];
    if (!bill) throw new Error("销售单不存在");
    const existingDeductRows = await conn.query<any[]>(
      "SELECT id FROM inventory_ledger WHERE biz_type = 'SALE_OUT' AND biz_no = ? AND tenant_id = ? LIMIT 1",
      [req.params.billNo, tenantId]
    );
    const alreadyDeducted = existingDeductRows[0].length > 0;
    const received = Number(bill.received_amount) + body.amount;
    const receivable = Number(bill.receivable_amount);
    if (body.amount <= 0 || body.amount > Math.max(receivable - Number(bill.received_amount), 0)) {
      throw new Error("收款金额不合法");
    }
    const status = received >= receivable ? "PAID" : "PARTIAL";
    await conn.execute(
      `UPDATE sale_bill SET received_amount = ?, unreceived_amount = GREATEST(receivable_amount - ?, 0), collection_status = ?, last_payment_time = NOW()
       WHERE bill_no = ? AND tenant_id = ?`,
      [received, received, status, req.params.billNo, tenantId]
    );
    await conn.execute(
      `INSERT INTO payment_order (pay_no, source_type, source_no, channel, amount, status, paid_at, tenant_id)
       VALUES (?, 'SALE_BILL', ?, ?, ?, 'SUCCESS', NOW(), ?)`,
      [makeBizNo("ZF"), req.params.billNo, body.paymentMethod, body.amount, tenantId]
    );
    if (!alreadyDeducted) {
      const [items] = await conn.query<any[]>(
        `SELECT sku_id AS skuId, total_bottle_qty AS quantity
         FROM sale_bill_item
         WHERE bill_no = ?`,
        [req.params.billNo]
      );
      for (const item of items) {
        const [inventoryRows] = await conn.query<any[]>(
          `SELECT physical_qty AS physicalQty, available_qty AS availableQty
           FROM inventory_balance
           WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE' AND tenant_id = ?
           FOR UPDATE`,
          [bill.store_id, item.skuId, tenantId]
        );
        const inventory = inventoryRows[0];
        const beforeQty = Number(inventory?.availableQty ?? 0);
        const quantity = Number(item.quantity ?? item.totalBottleQty);
        if (beforeQty < quantity) throw new Error("库存不足，无法完成收款出库");
        const afterQty = beforeQty - quantity;
        await conn.execute(
          `UPDATE inventory_balance
           SET physical_qty = physical_qty - ?,
               available_qty = available_qty - ?,
               updated_at = NOW()
           WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE' AND tenant_id = ?`,
          [quantity, quantity, bill.store_id ?? bill.storeId, item.skuId, tenantId]
        );
        await conn.execute(
          `INSERT INTO inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
                                         change_qty, before_qty, after_qty, before_locked_qty, after_locked_qty,
                                         operator_id, idempotency_key, remark, tenant_id)
           VALUES (?, ?, ?, 'OFFLINE', 'SALE_OUT', ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`,
          [
            makeBizNo("IL"),
            bill.store_id ?? bill.storeId,
            item.skuId,
            req.params.billNo,
            -quantity,
            beforeQty,
            afterQty,
            req.user!.id ?? null,
            `SALE_OUT:${req.params.billNo}:${item.skuId}`,
            body.remark ?? "线下收款销售出库",
            tenantId
          ]
        );
      }
    }
  });
  res.json(ok({ billNo: req.params.billNo }));
}));

// 查询超期赊销单
storeRouter.get("/sale-bills/overdue", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const storeId = req.user?.storeId ?? null;

  const records = await query<any>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_id AS customerId, customer_name AS customerName,
            customer_mobile AS customerMobile, sale_type AS saleType, due_date AS dueDate,
            collection_status AS collectionStatus, receivable_amount AS receivableAmount,
            received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount,
            created_at AS createdAt, DATEDIFF(CURDATE(), due_date) AS overdueDays
     FROM sale_bill
     WHERE tenant_id = ?
       AND sale_type = 'CREDIT'
       AND due_date IS NOT NULL
       AND due_date < CURDATE()
       AND collection_status IN ('UNPAID', 'PARTIAL')
       AND business_status = 'CREATED'
       AND (? IS NULL OR store_id = ?)
     ORDER BY due_date ASC
     LIMIT ? OFFSET ?`,
    [tenantId, storeId, storeId, pageSize, offset]
  );

  const total = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM sale_bill
     WHERE tenant_id = ?
       AND sale_type = 'CREDIT'
       AND due_date IS NOT NULL
       AND due_date < CURDATE()
       AND collection_status IN ('UNPAID', 'PARTIAL')
       AND business_status = 'CREATED'
       AND (? IS NULL OR store_id = ?)`,
    [tenantId, storeId, storeId]
  );

  res.json(ok({ total: total?.total ?? 0, page, pageSize, records }));
}));

storeRouter.post("/inventory/adjust", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    storeId: z.number().optional(),
    skuId: z.number(),
    stockType: z.enum(["ONLINE", "OFFLINE"]).default("OFFLINE"),
    change: z.number(),
    remark: z.string().optional()
  }).parse(req.body);
  const storeId = body.storeId ?? req.user?.storeId ?? 1;
  const result = await transaction(async (conn) => {
    const [rows] = await conn.query<any[]>(
      `SELECT physical_qty AS physicalQty
       FROM inventory_balance
       WHERE store_id = ? AND sku_id = ? AND stock_type = ? AND tenant_id = ?
       FOR UPDATE`,
      [storeId, body.skuId, body.stockType, tenantId]
    );
    const beforeQty = Number(rows[0]?.physicalQty ?? 0);
    await conn.execute(
      `UPDATE inventory_balance
       SET physical_qty = physical_qty + ?,
           available_qty = available_qty + ?,
           updated_at = NOW()
       WHERE store_id = ? AND sku_id = ? AND stock_type = ? AND tenant_id = ?`,
      [body.change, body.change, storeId, body.skuId, body.stockType, tenantId]
    );
    const afterQty = beforeQty + body.change;
    await conn.execute(
      `INSERT INTO inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
                                     change_qty, before_qty, after_qty, before_locked_qty, after_locked_qty,
                                     operator_id, idempotency_key, remark, tenant_id)
       VALUES (?, ?, ?, ?, 'ADJUST', ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`,
      [
        makeBizNo("IL"),
        storeId,
        body.skuId,
        body.stockType,
        makeBizNo("ADJ"),
        body.change,
        beforeQty,
        afterQty,
        req.user!.id ?? null,
        makeBizNo("IDEMP"),
        body.remark ?? "门店调整",
        tenantId
      ]
    );
    return { ok: true };
  });
  res.json(ok(result));
}));

storeRouter.get("/inventory/logs", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const storeId = req.query.storeId ? Number(req.query.storeId) : req.user?.storeId;
  let sql = `SELECT il.ledger_no AS logNo, il.store_id AS storeId, il.sku_id AS skuId,
                    ps.sku_name AS skuName, il.change_qty AS changeQty,
                    il.before_qty AS beforeQty, il.after_qty AS afterQty,
                    il.remark AS reason, il.operator_id AS operatorId, il.created_at AS createdAt
             FROM inventory_ledger il
             LEFT JOIN product_sku ps ON ps.id = il.sku_id AND ps.tenant_id = il.tenant_id
             WHERE il.tenant_id = ?`;
  const params: unknown[] = [tenantId];
  if (storeId) {
    sql += " AND il.store_id = ?";
    params.push(storeId);
  }
  sql += " ORDER BY il.created_at DESC LIMIT ? OFFSET ?";
  params.push(pageSize, offset);
  const records = await query<any>(sql, params);
  const totalSql = storeId
    ? "SELECT COUNT(*) AS total FROM inventory_ledger WHERE tenant_id = ? AND store_id = ?"
    : "SELECT COUNT(*) AS total FROM inventory_ledger WHERE tenant_id = ?";
  const totalRow = await queryOne<any>(totalSql, storeId ? [tenantId, storeId] : [tenantId]);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

storeRouter.get("/collection-links", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT link_no AS linkNo, source_type AS sourceType, source_no AS sourceNo,
            amount, paid_amount AS paidAmount, status,
            share_channel AS shareChannel, token, expire_at AS expireAt,
            created_at AS createdAt
     FROM collection_link
     WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM collection_link WHERE tenant_id = ?", [tenantId]);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

storeRouter.get("/payment-orders", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT pay_no AS payNo, source_type AS sourceType, source_no AS sourceNo,
            amount, status, channel AS paymentMethod,
            paid_at AS paidAt, created_at AS createdAt
     FROM payment_order
     WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM payment_order WHERE tenant_id = ?", [tenantId]);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

storeRouter.post("/hold-orders", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
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
    `INSERT INTO hold_order (hold_no, store_id, customer_name, customer_mobile, amount, payload, remark, status, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'HELD', ?)`,
    [holdNo, storeId, body.customerName, body.customerMobile, body.amount, payload, body.remark, tenantId]
  );
  res.json(ok({ holdNo, status: "HELD" }));
}));

storeRouter.get("/hold-orders", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT hold_no AS holdNo, store_id AS storeId, customer_name AS customerName,
            customer_mobile AS customerMobile, amount, remark, status, created_at AS createdAt
     FROM hold_order
     WHERE tenant_id = ?
       AND status = 'HELD'
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM hold_order WHERE tenant_id = ? AND status = 'HELD'", [tenantId]);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

storeRouter.post("/hold-orders/:holdNo/restore", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const hold = await queryOne<any>(
    `SELECT hold_no AS holdNo, customer_name AS customerName, customer_mobile AS customerMobile,
            amount, payload, remark, status, created_at AS createdAt
     FROM hold_order
     WHERE hold_no = ? AND status = 'HELD' AND tenant_id = ?`,
    [req.params.holdNo, tenantId]
  );
  if (!hold) {
    res.status(404).json({ code: "404", message: "挂单不存在" });
    return;
  }
  const payload = typeof hold.payload === "string" ? JSON.parse(hold.payload) : hold.payload;
  res.json(ok({ ...hold, ...payload }));
}));

storeRouter.delete("/hold-orders/:holdNo", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  await query(
    `UPDATE hold_order SET status = 'DELETED', updated_at = NOW() WHERE hold_no = ? AND tenant_id = ?`,
    [req.params.holdNo, tenantId]
  );
  res.json(ok({ holdNo: req.params.holdNo, status: "DELETED" }));
}));

storeRouter.get("/refund-orders", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT refund_no AS refundNo, pay_no AS payNo, source_type AS sourceType,
            source_no AS sourceNo, amount, reason, status, created_at AS createdAt
     FROM refund_order
     WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM refund_order WHERE tenant_id = ?", [tenantId]);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

storeRouter.get("/dashboard", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = req.query.storeId ? Number(req.query.storeId) : req.user?.storeId ?? null;
  const whereStore = storeId ? "WHERE tenant_id = ? AND store_id = ?" : "WHERE tenant_id = ?";
  const params = storeId ? [tenantId, storeId] : [tenantId];
  const todayOrders = await queryOne<any>(
    `SELECT COUNT(*) AS cnt FROM miniapp_order ${whereStore}`,
    params
  );
  const pendingOrders = await queryOne<any>(
    `SELECT COUNT(*) AS cnt FROM miniapp_order ${whereStore} AND order_status = 'PENDING_PAYMENT'`,
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
  const tenantId = req.tenantId!;
  const storeId = req.query.storeId ? Number(req.query.storeId) : req.user?.storeId ?? null;
  const where = storeId ? "WHERE sb.tenant_id = ? AND sb.store_id = ?" : "WHERE sb.tenant_id = ?";
  const params = storeId ? [tenantId, storeId] : [tenantId];
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
  const tenantId = req.tenantId!;
  const storeId = req.query.storeId ? Number(req.query.storeId) : req.user?.storeId ?? null;
  const where = storeId ? "WHERE ib.tenant_id = ? AND ib.store_id = ?" : "WHERE ib.tenant_id = ?";
  const params = storeId ? [tenantId, storeId] : [tenantId];
  const records = await query<any>(
    `SELECT ib.sku_id AS skuId, ps.sku_name AS skuName,
            ib.stock_type AS stockType, ib.available_qty AS availableQty
     FROM inventory_balance ib
     LEFT JOIN product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
     ${where} AND ib.available_qty <= 5
     ORDER BY ib.available_qty ASC
     LIMIT 20`,
    params
  );
  res.json(ok(records));
}));

storeRouter.get("/receivables", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const status = req.query.status ? String(req.query.status) : null;
  const keyword = `%${String(req.query.keyword || "")}%`;
  const storeId = req.user?.storeId ?? null;
  const records = await query<any>(
    `SELECT receivable_no AS receivableNo, source_type AS sourceType, source_no AS sourceNo,
            customer_name AS customerName, customer_mobile AS customerMobile,
            receivable_amount AS receivableAmount, received_amount AS receivedAmount,
            unreceived_amount AS unreceivedAmount, status, created_at AS createdAt
     FROM receivable_account
     WHERE tenant_id = ?
       AND (? IS NULL OR store_id = ?)
       AND (? IS NULL OR status = ?)
       AND (receivable_no LIKE ? OR source_no LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ?)
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, storeId, storeId, status, status, keyword, keyword, keyword, keyword, pageSize, offset]
  );
  const total = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM receivable_account
     WHERE tenant_id = ?
       AND (? IS NULL OR store_id = ?)
       AND (? IS NULL OR status = ?)
       AND (receivable_no LIKE ? OR source_no LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ?)`,
    [tenantId, storeId, storeId, status, status, keyword, keyword, keyword, keyword]
  );
  res.json(ok({ total: total?.total ?? 0, page, pageSize, records }));
}));

storeRouter.post("/receivables/:receivableNo/payment", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    amount: z.number().positive(),
    paymentMethod: z.enum(["CASH", "TRANSFER", "OTHER_WECHAT", "ALIPAY"]),
    remark: z.string().optional()
  }).parse(req.body);
  const result = await transaction(async (conn) => {
    const [rows] = await conn.query<any[]>(
      `SELECT receivable_no, source_no, received_amount, receivable_amount, unreceived_amount
       FROM receivable_account WHERE receivable_no = ? AND tenant_id = ? FOR UPDATE`,
      [req.params.receivableNo, tenantId]
    );
    const receivable = rows[0];
    if (!receivable) throw new Error("应收不存在");
    if (body.amount > Number(receivable.unreceived_amount)) throw new Error("收款金额不能超过未收金额");
    const receivedAmount = Number(receivable.received_amount) + body.amount;
    const unreceivedAmount = Math.max(Number(receivable.receivable_amount) - receivedAmount, 0);
    const status = unreceivedAmount === 0 ? "PAID" : "PARTIAL";
    await conn.execute(
      `UPDATE receivable_account
       SET received_amount = ?, unreceived_amount = ?, status = ?, last_payment_time = NOW()
       WHERE receivable_no = ? AND tenant_id = ?`,
      [receivedAmount, unreceivedAmount, status, req.params.receivableNo, tenantId]
    );
    await conn.execute(
      `INSERT INTO payment_order (pay_no, source_type, source_no, channel, amount, status, paid_at, tenant_id)
       VALUES (?, 'RECEIVABLE', ?, ?, ?, 'SUCCESS', NOW(), ?)`,
      [makeBizNo("ZF"), req.params.receivableNo, body.paymentMethod, body.amount, tenantId]
    );
    return { receivableNo: req.params.receivableNo, receivedAmount, unreceivedAmount, status };
  });
  res.json(ok(result));
}));

// 销售单收款（支持赊销状态流转：UNPAID -> PARTIAL -> PAID）
storeRouter.post("/sale-bills/:billNo/payment", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    amount: z.number().positive(),
    paymentMethod: z.enum(["CASH", "TRANSFER", "OTHER_WECHAT", "ALIPAY"]),
    remark: z.string().optional()
  }).parse(req.body);

  const result = await transaction(async (conn) => {
    const [rows] = await conn.query<any[]>(
      `SELECT bill_no, store_id, received_amount, receivable_amount, unreceived_amount, collection_status
       FROM sale_bill WHERE bill_no = ? AND tenant_id = ? FOR UPDATE`,
      [req.params.billNo, tenantId]
    );
    const bill = rows[0];
    if (!bill) throw new Error("销售单不存在");

    const received = Number(bill.received_amount) + body.amount;
    const receivable = Number(bill.receivable_amount);
    if (body.amount <= 0 || body.amount > Math.max(receivable - Number(bill.received_amount), 0)) {
      throw new Error("收款金额不合法");
    }

    const status = received >= receivable ? "PAID" : "PARTIAL";
    await conn.execute(
      `UPDATE sale_bill
       SET received_amount = ?, unreceived_amount = GREATEST(receivable_amount - ?, 0),
           collection_status = ?, last_payment_time = NOW()
       WHERE bill_no = ? AND tenant_id = ?`,
      [received, received, status, req.params.billNo, tenantId]
    );

    await conn.execute(
      `INSERT INTO payment_order (pay_no, source_type, source_no, channel, amount, status, paid_at, tenant_id)
       VALUES (?, 'SALE_BILL', ?, ?, ?, 'SUCCESS', NOW(), ?)`,
      [makeBizNo("ZF"), req.params.billNo, body.paymentMethod, body.amount, tenantId]
    );

    await conn.execute(
      `INSERT INTO operation_log (operator_id, operator_name, module, action, biz_no, after_data, tenant_id)
       VALUES (?, ?, 'SALE_BILL', 'PAYMENT', ?, ?, ?)`,
      [req.user!.id ?? null, req.user!.username ?? "系统用户", req.params.billNo,
       JSON.stringify({ amount: body.amount, received, status }), tenantId]
    );

    return { billNo: req.params.billNo, receivedAmount: received, collectionStatus: status };
  });

  res.json(ok(result));
}));

// 超期销售单检测
storeRouter.get("/sale-bills/overdue/check", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = req.user?.storeId ?? null;

  let sql = `SELECT bill_no AS billNo, store_id AS storeId, customer_name AS customerName,
                    due_date AS dueDate, receivable_amount AS receivableAmount,
                    unreceived_amount AS unreceivedAmount, collection_status AS collectionStatus
             FROM sale_bill
             WHERE tenant_id = ?
               AND sale_type = 'CREDIT'
               AND collection_status IN ('UNPAID', 'PARTIAL')
               AND due_date IS NOT NULL
               AND due_date < CURDATE()`;
  const params: unknown[] = [tenantId];

  if (storeId) {
    sql += ` AND store_id = ?`;
    params.push(storeId);
  }

  sql += ` ORDER BY due_date ASC LIMIT 100`;

  const overdueBills = await query<any>(sql, params);

  // 标记超期
  if (overdueBills.length > 0) {
    const billNos = overdueBills.map((b: any) => b.billNo);
    await query(
      `UPDATE sale_bill SET collection_status = 'OVERDUE'
       WHERE bill_no IN (${billNos.map(() => '?').join(',')})
         AND tenant_id = ?
         AND collection_status IN ('UNPAID', 'PARTIAL')`,
      [...billNos, tenantId]
    );
  }

  res.json(ok({ count: overdueBills.length, overdueBills }));
}));
