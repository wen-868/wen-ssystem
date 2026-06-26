import { query, queryOne } from "../../shared/db.js";

export async function listMembers(tenantId: string, page: number, pageSize: number, keyword: string) {
  const offset = (page - 1) * pageSize;
  const kw = `%${keyword}%`;
  const records = await query<any>(
    `SELECT m.id AS memberId, m.name, m.mobile, m.customer_type AS customerType,
            m.points, m.level_code AS levelCode, m.status,
            m.staff_id AS staffId, u.real_name AS staffName
     FROM member m
     LEFT JOIN sys_user u ON u.id = m.staff_id
     WHERE m.tenant_id = ? AND (m.name LIKE ? OR m.mobile LIKE ?)
     ORDER BY m.id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, kw, kw, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM member WHERE tenant_id = ?", [tenantId]);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function createCustomer(tenantId: string, body: { name: string; mobile: string; customerType: string; staffId?: number }) {
  const levelCode = body.customerType === "WHOLESALE" ? "WHOLESALE" : "NORMAL";
  const result = await query<any>(
    `INSERT INTO member (name, mobile, customer_type, staff_id, points, level_code, status, tenant_id)
     VALUES (?, ?, ?, ?, 0, ?, 1, ?)`,
    [body.name, body.mobile, body.customerType, body.staffId ?? null, levelCode, tenantId]
  );
  const memberId = result?.[0]?.insertId ?? Date.now();
  return { memberId, name: body.name, mobile: body.mobile, customerType: body.customerType, staffId: body.staffId ?? null };
}

export async function getCustomerDetail(tenantId: string, memberId: number) {
  const member = await queryOne<any>(
    `SELECT m.id AS memberId, m.name, m.mobile, m.customer_type AS customerType,
            m.points, m.level_code AS levelCode, m.status,
            m.staff_id AS staffId, u.real_name AS staffName
     FROM member m
     LEFT JOIN sys_user u ON u.id = m.staff_id
     WHERE m.id = ? AND m.tenant_id = ?`,
    [memberId, tenantId]
  );
  if (!member) {
    throw Object.assign(new Error("客户不存在"), { statusCode: 404 });
  }
  return member;
}

export async function updateCustomer(tenantId: string, memberId: number, body: { name?: string; mobile?: string; address?: string; customerType?: string; levelCode?: string; settlementType?: string; remark?: string }) {
  const existing = await queryOne<any>("SELECT id FROM member WHERE id = ? AND tenant_id = ?", [memberId, tenantId]);
  if (!existing) {
    throw Object.assign(new Error("客户不存在"), { statusCode: 404 });
  }
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
  if (body.mobile !== undefined) { sets.push("mobile = ?"); params.push(body.mobile); }
  if (body.address !== undefined) { sets.push("address = ?"); params.push(body.address); }
  if (body.customerType !== undefined) { sets.push("customer_type = ?"); params.push(body.customerType); }
  if (body.levelCode !== undefined) { sets.push("level_code = ?"); params.push(body.levelCode); }
  if (body.settlementType !== undefined) { sets.push("settlement_type = ?"); params.push(body.settlementType); }
  if (body.remark !== undefined) { sets.push("remark = ?"); params.push(body.remark); }
  if (sets.length === 0) { return { memberId }; }
  sets.push("updated_at = NOW()");
  params.push(memberId, tenantId);
  await query(`UPDATE member SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, params);
  return { memberId };
}

export async function disableCustomer(tenantId: string, memberId: number) {
  const existing = await queryOne<any>("SELECT id, name, status FROM member WHERE id = ? AND tenant_id = ?", [memberId, tenantId]);
  if (!existing) {
    throw Object.assign(new Error("客户不存在"), { statusCode: 404 });
  }
  if (existing.status === "INACTIVE") {
    throw Object.assign(new Error("客户已停用"), { statusCode: 400 });
  }
  await query("UPDATE member SET status = 'INACTIVE', updated_at = NOW() WHERE id = ? AND tenant_id = ?", [memberId, tenantId]);
  return { memberId, name: existing.name };
}

export async function assignStaffToCustomer(tenantId: string, memberId: number, staffId: number) {
  const member = await queryOne<any>("SELECT id FROM member WHERE id = ? AND tenant_id = ?", [memberId, tenantId]);
  if (!member) {
    throw Object.assign(new Error("客户不存在"), { statusCode: 404 });
  }
  const staff = await queryOne<any>("SELECT id FROM sys_user WHERE id = ? AND status = 1", [staffId]);
  if (!staff) {
    throw Object.assign(new Error("员工不存在"), { statusCode: 404 });
  }
  await query("UPDATE member SET staff_id = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?", [staffId, memberId, tenantId]);
  return { memberId, staffId };
}

export async function getCustomerPriceHistory(tenantId: string, memberId: number, skuId: number) {
  const records = await query<any>(
    `SELECT sbi.sku_id AS skuId, sbi.sku_name AS skuName, sbi.unit_price AS unitPrice,
            sb.bill_no AS billNo, sb.created_at AS createdAt
     FROM sale_bill_item sbi
     JOIN sale_bill sb ON sb.bill_no = sbi.bill_no
     WHERE sb.customer_id = ? AND sbi.sku_id = ? AND sb.tenant_id = ?
     ORDER BY sb.created_at DESC`,
    [memberId, skuId, tenantId]
  );
  if (records.length === 0) {
    return [];
  }
  const prices = records.map((r: any) => Number(r.unitPrice));
  return [{
    skuId,
    skuName: records[0].skuName,
    lastPrice: prices[0],
    highestPrice: Math.max(...prices),
    lowestPrice: Math.min(...prices),
    billCount: records.length,
    lastBillNo: records[0].billNo
  }];
}

export async function listCustomerSaleBills(tenantId: string, memberId: number, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_name AS customerName,
            customer_mobile AS customerMobile, customer_type AS customerType,
            receivable_amount AS receivableAmount, received_amount AS receivedAmount,
            unreceived_amount AS unreceivedAmount,
            collection_status AS collectionStatus, business_status AS businessStatus,
            created_at AS createdAt
     FROM sale_bill
     WHERE customer_id = ? AND tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [memberId, tenantId, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM sale_bill WHERE customer_id = ? AND tenant_id = ?", [memberId, tenantId]);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listCustomerPayments(tenantId: string, memberId: number, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT id, receipt_no AS receiptNo, source_type AS sourceType, source_no AS sourceNo,
            customer_id AS customerId, customer_name AS customerName,
            amount, payment_method AS paymentMethod,
            voucher_no AS voucherNo, payment_date AS paymentDate,
            status, remark, created_at AS createdAt, 'SALE_PAYMENT' AS paymentTable
     FROM sale_payment
     WHERE customer_id = ? AND tenant_id = ?
     UNION ALL
     SELECT id, receipt_no AS receiptNo, source_type AS sourceType, source_no AS sourceNo,
            customer_id AS customerId, customer_name AS customerName,
            amount, payment_method AS paymentMethod,
            voucher_no AS voucherNo, payment_date AS paymentDate,
            status, remark, created_at AS createdAt, 'CUSTOMER_PAYMENT' AS paymentTable
     FROM customer_payment
     WHERE customer_id = ? AND tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [memberId, tenantId, memberId, tenantId, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT
        (SELECT COUNT(*) FROM sale_payment WHERE customer_id = ? AND tenant_id = ?) +
        (SELECT COUNT(*) FROM customer_payment WHERE customer_id = ? AND tenant_id = ?) AS total`,
    [memberId, tenantId, memberId, tenantId]
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listCustomerStatements(tenantId: string, memberId: number, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT id, statement_no AS statementNo, customer_id AS customerId, customer_name AS customerName,
            statement_type AS statementType, start_date AS startDate, end_date AS endDate,
            opening_balance AS openingBalance, total_sales AS totalSales,
            total_returns AS totalReturns, total_payments AS totalPayments,
            closing_balance AS closingBalance,
            status, confirmed_at AS confirmedAt, created_at AS createdAt
     FROM customer_statement
     WHERE customer_id = ? AND tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [memberId, tenantId, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    "SELECT COUNT(*) AS total FROM customer_statement WHERE customer_id = ? AND tenant_id = ?",
    [memberId, tenantId]
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function getCustomerPurchaseStats(tenantId: string, memberId: number) {
  const billStats = await queryOne<any>(
    `SELECT COUNT(*) AS billCount,
            COALESCE(SUM(receivable_amount), 0) AS totalAmount,
            COALESCE(SUM(received_amount), 0) AS receivedAmount,
            COALESCE(SUM(unreceived_amount), 0) AS unpaidAmount
     FROM sale_bill
     WHERE customer_id = ? AND tenant_id = ? AND business_status NOT IN ('DRAFT', 'VOIDED')`,
    [memberId, tenantId]
  );

  const topProducts = await query<any>(
    `SELECT sbi.sku_id AS skuId, sbi.sku_name AS skuName,
            SUM(sbi.total_bottle_qty) AS totalQty,
            SUM(sbi.subtotal_amount) AS totalAmount
     FROM sale_bill_item sbi
     JOIN sale_bill sb ON sb.bill_no = sbi.bill_no
     WHERE sb.customer_id = ? AND sb.tenant_id = ? AND sb.business_status NOT IN ('DRAFT', 'VOIDED')
     GROUP BY sbi.sku_id, sbi.sku_name
     ORDER BY totalQty DESC
     LIMIT 10`,
    [memberId, tenantId]
  );

  const lastOrder = await queryOne<any>(
    `SELECT MAX(created_at) AS lastOrderAt FROM sale_bill WHERE customer_id = ? AND tenant_id = ? AND business_status NOT IN ('DRAFT', 'VOIDED')`,
    [memberId, tenantId]
  );

  return {
    memberId,
    billCount: Number(billStats?.billCount ?? 0),
    totalAmount: Number(billStats?.totalAmount ?? 0),
    receivedAmount: Number(billStats?.receivedAmount ?? 0),
    unpaidAmount: Number(billStats?.unpaidAmount ?? 0),
    lastOrderAt: lastOrder?.lastOrderAt ?? null,
    topProducts
  };
}

export async function getCustomerStats(tenantId: string) {
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM member WHERE status = 1 AND tenant_id = ?", [tenantId]);
  const newMonthRow = await queryOne<any>(
    "SELECT COUNT(*) AS cnt FROM member WHERE status = 1 AND tenant_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')",
    [tenantId]
  );
  const activeRow = await queryOne<any>(
    `SELECT COUNT(DISTINCT customer_id) AS cnt
     FROM sale_bill
     WHERE customer_id IS NOT NULL
       AND tenant_id = ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')
       AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    [tenantId]
  );
  const debtRow = await queryOne<any>(
    `SELECT COUNT(DISTINCT customer_id) AS cnt
     FROM sale_bill
     WHERE customer_id IS NOT NULL
       AND tenant_id = ?
       AND unreceived_amount > 0
       AND business_status NOT IN ('DRAFT', 'VOIDED')`,
    [tenantId]
  );
  const receivableRow = await queryOne<any>(
    `SELECT COALESCE(SUM(unreceived_amount), 0) AS total
     FROM sale_bill
     WHERE customer_id IS NOT NULL
       AND tenant_id = ?
       AND unreceived_amount > 0
       AND business_status NOT IN ('DRAFT', 'VOIDED')`,
    [tenantId]
  );

  return {
    total: Number(totalRow?.total ?? 0),
    newThisMonth: Number(newMonthRow?.cnt ?? 0),
    activeCount: Number(activeRow?.cnt ?? 0),
    debtCount: Number(debtRow?.cnt ?? 0),
    totalReceivable: Number(receivableRow?.total ?? 0)
  };
}