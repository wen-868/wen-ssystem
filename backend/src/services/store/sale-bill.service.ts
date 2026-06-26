import { query, queryOne, transaction } from "../../shared/db.js";
import { makeBizNo, makeToken } from "../../shared/id.js";

export async function listSaleBills(params: {
  page: number; pageSize: number; storeId: number | null;
  keyword: string; collectionStatus: string | null; tenantId: string;
}) {
  const { page, pageSize, storeId, keyword, collectionStatus, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const kw = `%${keyword}%`;
  const records = await query<any>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_id AS customerId, customer_name AS customerName,
            customer_type AS customerType, sale_type AS saleType, business_status AS businessStatus, 
            collection_status AS collectionStatus, receivable_amount AS receivableAmount, 
            received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount,
            due_date AS dueDate, created_at AS createdAt
     FROM sale_bill
     WHERE tenant_id = ?
       AND (? IS NULL OR store_id = ?)
       AND (? IS NULL OR collection_status = ?)
       AND (bill_no LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ?)
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, storeId, storeId, collectionStatus, collectionStatus, kw, kw, kw, pageSize, offset]
  );
  const total = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM sale_bill
     WHERE tenant_id = ?
       AND (? IS NULL OR store_id = ?)
       AND (? IS NULL OR collection_status = ?)
       AND (bill_no LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ?)`,
    [tenantId, storeId, storeId, collectionStatus, collectionStatus, kw, kw, kw]
  );
  return { total: total?.total ?? 0, page, pageSize, records };
}

export async function getSaleBillDetail(billNo: string, tenantId: string) {
  const bill = await queryOne<any>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_id AS customerId, customer_name AS customerName,
            customer_type AS customerType, sale_type AS saleType, business_status AS businessStatus, 
            collection_status AS collectionStatus, goods_amount AS goodsAmount, discount_amount AS discountAmount,
            rounding_amount AS roundingAmount, receivable_amount AS receivableAmount, 
            received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount,
            due_date AS dueDate, remark, created_at AS createdAt
     FROM sale_bill WHERE bill_no = ? AND tenant_id = ?`,
    [billNo, tenantId]
  );
  if (!bill) return null;
  const items = await query<any>(
    `SELECT sku_id AS skuId, sku_name AS skuName, box_qty AS boxQty, bottle_qty AS bottleQty,
            total_bottle_qty AS totalBottleQty, unit_price AS unitPrice, subtotal_amount AS subtotalAmount
     FROM sale_bill_item WHERE bill_no = ?`,
    [billNo]
  );
  return { ...bill, items };
}

export async function createSaleBill(params: {
  storeId: number; customerId: number | null; customerName?: string;
  customerMobile?: string; discountAmount: number; roundingAmount: number;
  remark?: string; internalRemark?: string; saleType: "CASH" | "CREDIT";
  dueDate?: string; items: Array<{skuId: number; boxQty: number; bottleQty: number;
    totalBottleQty: number; unitPrice?: number; priceType?: string; }>;
  userId: number; tenantId: string;
}) {
  const { tenantId, userId, storeId, customerId, customerName, customerMobile,
    discountAmount, roundingAmount, remark, internalRemark, saleType, dueDate, items } = params;
  return transaction(async (conn) => {
    const billNo = makeBizNo("XS");
    const member = customerId
      ? await queryOne<any>("SELECT id, name, mobile, customer_type FROM member WHERE id = ? AND tenant_id = ?", [customerId, tenantId])
      : null;
    let goodsAmount = 0;
    const itemSnapshots = [];
    for (const item of items) {
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
    const receivableAmount = Math.max(0, goodsAmount - discountAmount - roundingAmount);
    await conn.execute(
      `INSERT INTO sale_bill (bill_no, store_id, customer_id, customer_name, customer_mobile, customer_type,
                              sale_type, business_status, collection_status, goods_amount, discount_amount, rounding_amount,
                              receivable_amount, received_amount, unreceived_amount, due_date, operator_id, remark, internal_remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'CREATED', 'UNPAID', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
      [
        billNo, storeId, customerId ?? null, member?.name ?? customerName ?? null, member?.mobile ?? customerMobile ?? null,
        member?.customer_type ?? "RETAIL", saleType, goodsAmount, discountAmount, roundingAmount, receivableAmount, receivableAmount,
        saleType === "CREDIT" ? dueDate ?? null : null, userId, remark ?? null, internalRemark ?? null, tenantId
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
}

export async function createCollectionLink(params: {
  billNo: string; shareChannel: string; amount: number;
  taxEnabled: boolean; taxRate: number; expireHours: number;
  remark?: string; userId: number; tenantId: string;
}) {
  const { billNo, shareChannel, amount, taxEnabled, taxRate, expireHours, remark, userId, tenantId } = params;
  const bill = await queryOne<any>("SELECT bill_no, unreceived_amount FROM sale_bill WHERE bill_no = ? AND tenant_id = ?", [billNo, tenantId]);
  if (!bill) throw new Error("销售单不存在");
  if (amount <= 0 || amount > Number(bill.unreceived_amount)) throw new Error("收款金额必须大于0且不能超过未收金额");
  const linkNo = makeBizNo("SK");
  const token = makeToken();
  const taxAmount = taxEnabled ? Number((amount * taxRate).toFixed(2)) : 0;
  await query(
    `INSERT INTO collection_link (link_no, source_type, source_no, amount, paid_amount, status, share_channel, share_user_id, expire_at, token, tax_enabled, tax_rate, tax_amount, tenant_id)
     VALUES (?, 'SALE_BILL', ?, ?, 0, 'PENDING', ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?, ?, ?, ?, ?)`,
    [linkNo, billNo, amount, shareChannel, userId, expireHours, token, taxEnabled ? 1 : 0, taxRate, taxAmount, tenantId]
  );
  await query(
    `UPDATE sale_bill SET collection_status = 'SHARED', share_collection_count = share_collection_count + 1, last_share_time = NOW(), locked_amount_flag = 1 WHERE bill_no = ? AND tenant_id = ?`,
    [billNo, tenantId]
  );
  return { linkNo, sourceType: "SALE_BILL", sourceNo: billNo, amount, taxEnabled, taxRate, taxAmount, paidAmount: 0, status: "PENDING", shareUrl: `/share/collections/${token}`, token };
}

export async function offlinePayment(params: {
  billNo: string; amount: number; paymentMethod: string;
  remark?: string; userId: number; username: string; tenantId: string;
}) {
  const { billNo, amount, paymentMethod, remark, userId, username, tenantId } = params;
  return transaction(async (conn) => {
    const [rows] = await conn.query<any[]>(
      "SELECT bill_no, store_id, received_amount, receivable_amount, collection_status FROM sale_bill WHERE bill_no = ? AND tenant_id = ? FOR UPDATE",
      [billNo, tenantId]
    );
    const bill = rows[0];
    if (!bill) throw new Error("销售单不存在");
    const existingDeductRows = await conn.query<any[]>(
      "SELECT id FROM inventory_ledger WHERE biz_type = 'SALE_OUT' AND biz_no = ? AND tenant_id = ? LIMIT 1",
      [billNo, tenantId]
    );
    const alreadyDeducted = existingDeductRows[0].length > 0;
    const received = Number(bill.received_amount) + amount;
    const receivable = Number(bill.receivable_amount);
    if (amount <= 0 || amount > Math.max(receivable - Number(bill.received_amount), 0)) throw new Error("收款金额不合法");
    const status = received >= receivable ? "PAID" : "PARTIAL";
    await conn.execute(
      `UPDATE sale_bill SET received_amount = ?, unreceived_amount = GREATEST(receivable_amount - ?, 0), collection_status = ?, last_payment_time = NOW() WHERE bill_no = ? AND tenant_id = ?`,
      [received, received, status, billNo, tenantId]
    );
    await conn.execute(
      `INSERT INTO payment_order (pay_no, source_type, source_no, channel, amount, status, paid_at, tenant_id) VALUES (?, 'SALE_BILL', ?, ?, ?, 'SUCCESS', NOW(), ?)`,
      [makeBizNo("ZF"), billNo, paymentMethod, amount, tenantId]
    );
    if (!alreadyDeducted) {
      const [items] = await conn.query<any[]>(
        `SELECT sku_id AS skuId, total_bottle_qty AS quantity FROM sale_bill_item WHERE bill_no = ?`, [billNo]
      );
      for (const item of items) {
        const [inventoryRows] = await conn.query<any[]>(
          `SELECT physical_qty AS physicalQty, available_qty AS availableQty FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE' AND tenant_id = ? FOR UPDATE`,
          [bill.store_id, item.skuId, tenantId]
        );
        const inventory = inventoryRows[0];
        const beforeQty = Number(inventory?.availableQty ?? 0);
        const quantity = Number(item.quantity ?? item.totalBottleQty);
        if (beforeQty < quantity) throw new Error("库存不足，无法完成收款出库");
        const afterQty = beforeQty - quantity;
        await conn.execute(
          `UPDATE inventory_balance SET physical_qty = physical_qty - ?, available_qty = available_qty - ?, updated_at = NOW() WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE' AND tenant_id = ?`,
          [quantity, quantity, bill.store_id ?? bill.storeId, item.skuId, tenantId]
        );
        await conn.execute(
          `INSERT INTO inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no, change_qty, before_qty, after_qty, before_locked_qty, after_locked_qty, operator_id, idempotency_key, remark, tenant_id) VALUES (?, ?, ?, 'OFFLINE', 'SALE_OUT', ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`,
          [makeBizNo("IL"), bill.store_id ?? bill.storeId, item.skuId, billNo, -quantity, beforeQty, afterQty, userId ?? null, `SALE_OUT:${billNo}:${item.skuId}`, remark ?? "线下收款销售出库", tenantId]
        );
      }
    }
    return { billNo, receivedAmount: received, collectionStatus: status };
  });
}

export async function paymentOnSaleBill(params: {
  billNo: string; amount: number; paymentMethod: string;
  remark?: string; userId: number; username: string; tenantId: string;
}) {
  const { billNo, amount, paymentMethod, remark, userId, username, tenantId } = params;
  return transaction(async (conn) => {
    const [rows] = await conn.query<any[]>(
      `SELECT bill_no, store_id, received_amount, receivable_amount, unreceived_amount, collection_status FROM sale_bill WHERE bill_no = ? AND tenant_id = ? FOR UPDATE`,
      [billNo, tenantId]
    );
    const bill = rows[0];
    if (!bill) throw new Error("销售单不存在");
    const received = Number(bill.received_amount) + amount;
    const receivable = Number(bill.receivable_amount);
    if (amount <= 0 || amount > Math.max(receivable - Number(bill.received_amount), 0)) throw new Error("收款金额不合法");
    const status = received >= receivable ? "PAID" : "PARTIAL";
    await conn.execute(
      `UPDATE sale_bill SET received_amount = ?, unreceived_amount = GREATEST(receivable_amount - ?, 0), collection_status = ?, last_payment_time = NOW() WHERE bill_no = ? AND tenant_id = ?`,
      [received, received, status, billNo, tenantId]
    );
    await conn.execute(
      `INSERT INTO payment_order (pay_no, source_type, source_no, channel, amount, status, paid_at, tenant_id) VALUES (?, 'SALE_BILL', ?, ?, ?, 'SUCCESS', NOW(), ?)`,
      [makeBizNo("ZF"), billNo, paymentMethod, amount, tenantId]
    );
    await conn.execute(
      `INSERT INTO operation_log (operator_id, operator_name, module, action, biz_no, after_data, tenant_id) VALUES (?, ?, 'SALE_BILL', 'PAYMENT', ?, ?, ?)`,
      [userId ?? null, username ?? "系统用户", billNo, JSON.stringify({ amount, received, status }), tenantId]
    );
    return { billNo, receivedAmount: received, collectionStatus: status };
  });
}

export async function listOverdueBills(params: {
  page: number; pageSize: number; storeId: number | null; tenantId: string;
}) {
  const { page, pageSize, storeId, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_id AS customerId, customer_name AS customerName,
            customer_mobile AS customerMobile, sale_type AS saleType, due_date AS dueDate,
            collection_status AS collectionStatus, receivable_amount AS receivableAmount,
            received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount,
            created_at AS createdAt, DATEDIFF(CURDATE(), due_date) AS overdueDays
     FROM sale_bill
     WHERE tenant_id = ? AND sale_type = 'CREDIT' AND due_date IS NOT NULL AND due_date < CURDATE()
       AND collection_status IN ('UNPAID', 'PARTIAL') AND business_status = 'CREATED'
       AND (? IS NULL OR store_id = ?)
     ORDER BY due_date ASC LIMIT ? OFFSET ?`,
    [tenantId, storeId, storeId, pageSize, offset]
  );
  const total = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM sale_bill WHERE tenant_id = ? AND sale_type = 'CREDIT' AND due_date IS NOT NULL AND due_date < CURDATE() AND collection_status IN ('UNPAID', 'PARTIAL') AND business_status = 'CREATED' AND (? IS NULL OR store_id = ?)`,
    [tenantId, storeId, storeId]
  );
  return { total: total?.total ?? 0, page, pageSize, records };
}

export async function checkOverdueBills(storeId: number | null, tenantId: string) {
  let sql = `SELECT bill_no AS billNo, store_id AS storeId, customer_name AS customerName, due_date AS dueDate, receivable_amount AS receivableAmount, unreceived_amount AS unreceivedAmount, collection_status AS collectionStatus FROM sale_bill WHERE tenant_id = ? AND sale_type = 'CREDIT' AND collection_status IN ('UNPAID', 'PARTIAL') AND due_date IS NOT NULL AND due_date < CURDATE()`;
  const params: unknown[] = [tenantId];
  if (storeId) { sql += ` AND store_id = ?`; params.push(storeId); }
  sql += ` ORDER BY due_date ASC LIMIT 100`;
  const overdueBills = await query<any>(sql, params);
  if (overdueBills.length > 0) {
    const billNos = overdueBills.map((b: any) => b.billNo);
    await query(
      `UPDATE sale_bill SET collection_status = 'OVERDUE' WHERE bill_no IN (${billNos.map(() => '?').join(',')}) AND tenant_id = ? AND collection_status IN ('UNPAID', 'PARTIAL')`,
      [...billNos, tenantId]
    );
  }
  return { count: overdueBills.length, overdueBills };
}