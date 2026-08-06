import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { syncChangedFields, detectChangedFields } from "../../shared/field-sync";
import { getCustomerLevelCode, type CustomerType } from "../../shared/fulfillment";

// ==================== 类型定义 ====================

/** 客户列表行 */
interface MemberListRow {
  memberId: number;
  name: string;
  contact: string | null;
  mobile: string;
  customerType: string;
  address: string | null;
  settlementType: string | null;
  remark: string | null;
  points: number;
  levelCode: string;
  status: number | string;
  staffId: number | null;
  staffName: string | null;
  totalSpent: number | string;
  arrears: number | string;
}

/** 客户详情行 */
interface MemberDetailRow {
  memberId: number;
  name: string;
  contact: string | null;
  mobile: string;
  customerType: string;
  address: string | null;
  settlementType: string | null;
  remark: string | null;
  points: number;
  levelCode: string;
  status: number | string;
  staffId: number | null;
  staffName: string | null;
}

/** 客户基本信息行 */
interface MemberBasicRow {
  id: number;
  name: string;
  mobile: string;
}

/** 客户状态行 */
interface MemberStatusRow {
  id: number;
  name: string;
  status: string | number;
}

/** ID 行 */
interface IdRow {
  id: number;
}

/** 计数 total 行 */
interface CountTotalRow {
  total: number;
}

/** 计数 cnt 行 */
interface CountCntRow {
  cnt: number;
}

/** INSERT 结果行 */
interface InsertResultRow {
  insertId: number;
  affectedRows: number;
}

/** 客户价格历史行 */
interface CustomerPriceRow {
  skuId: number;
  skuName: string;
  unitPrice: number | string;
  billNo: string;
  createdAt: string | Date;
}

/** 客户销售单行 */
interface CustomerSaleBillRow {
  billNo: string;
  storeId: number;
  customerName: string;
  customerMobile: string;
  customerType: string;
  receivableAmount: number | string;
  receivedAmount: number | string;
  unreceivedAmount: number | string;
  collectionStatus: string;
  businessStatus: string;
  createdAt: string | Date;
}

/** 客户付款记录行 */
interface CustomerPaymentRow {
  id: number;
  receiptNo: string;
  sourceType: string;
  sourceNo: string;
  customerId: number;
  customerName: string;
  amount: number | string;
  paymentMethod: string;
  voucherNo: string | null;
  paymentDate: string | Date;
  status: string;
  remark: string | null;
  createdAt: string | Date;
  paymentTable: string;
}

/** 客户对账单行 */
interface CustomerStatementRow {
  id: number;
  statementNo: string;
  customerId: number;
  customerName: string;
  statementType: string;
  startDate: string | Date;
  endDate: string | Date;
  openingBalance: number | string;
  totalSales: number | string;
  totalReturns: number | string;
  totalPayments: number | string;
  closingBalance: number | string;
  status: string;
  confirmedAt: string | Date | null;
  createdAt: string | Date;
}

/** 客户购买统计行 */
interface PurchaseStatsRow {
  billCount: number;
  totalAmount: number | string;
  receivedAmount: number | string;
  unpaidAmount: number | string;
}

/** 热销商品行 */
interface TopProductRow {
  skuId: number;
  skuName: string;
  totalQty: number | string;
  totalAmount: number | string;
}

/** 最后订单时间行 */
interface LastOrderRow {
  lastOrderAt: string | Date | null;
}

export async function listMembers(tenantId: string, page: number, pageSize: number, keyword: string) {
  const offset = (page - 1) * pageSize;
  const kw = `%${keyword}%`;
  // 使用 LEFT JOIN + GROUP BY 替代相关子查询，减少数据库查询次数
  // R54-04：补充 address/settlement_type/remark 字段，修复列表页这些字段显示为空的 Bug
  const records = await queryWithTenant<MemberListRow>(
    `SELECT m.id AS memberId, m.name, m.contact, m.mobile, m.customer_type AS customerType,
            m.address, m.settlement_type AS settlementType, m.remark,
            m.points, m.level_code AS levelCode, m.status,
            m.staff_id AS staffId, u.real_name AS staffName,
    COALESCE(SUM(sb.receivable_amount), 0) AS totalSpent,
    COALESCE(SUM(sb.unreceived_amount), 0) AS arrears
     FROM t_member m
     LEFT JOIN t_sys_user u ON u.id = m.staff_id
     LEFT JOIN t_sale_bill sb ON sb.customer_id = m.id AND sb.business_status NOT IN('DRAFT', 'VOIDED')
     WHERE m.tenant_id = ? AND(m.name LIKE ? OR m.mobile LIKE ?)
     GROUP BY m.id, m.name, m.contact, m.mobile, m.customer_type, m.address, m.settlement_type, m.remark, m.points, m.level_code, m.status, m.staff_id, u.real_name
     ORDER BY m.id DESC
     LIMIT ? OFFSET ? `,
    [tenantId, kw, kw, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>("SELECT COUNT(*) AS total FROM t_member WHERE tenant_id = ? AND (name LIKE ? OR mobile LIKE ?)", [tenantId, kw, kw], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function createCustomer(tenantId: string, body: { name: string; mobile: string; customerType: string; staffId?: number; address?: string; settlementType?: string; remark?: string; contact?: string }) {
  const levelCode = getCustomerLevelCode(body.customerType as CustomerType);
  const result = await queryWithTenant<InsertResultRow>(
    `INSERT INTO t_member (name, contact, mobile, customer_type, staff_id, address, settlement_type, remark, points, level_code, status, tenant_id)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1, ?)`,
    [body.name, body.contact ?? null, body.mobile, body.customerType, body.staffId ?? null, body.address ?? null, body.settlementType ?? 'CASH', body.remark ?? null, levelCode, tenantId],
    tenantId
  );
  const memberId = result?.[0]?.insertId;
  if (!memberId) throw new Error("创建客户失败");
  return { memberId, name: body.name, contact: body.contact ?? null, mobile: body.mobile, customerType: body.customerType, staffId: body.staffId ?? null, address: body.address ?? null, settlementType: body.settlementType ?? 'CASH', remark: body.remark ?? null };
}

export async function getCustomerDetail(tenantId: string, memberId: number) {
  // R54-04：补充 address/settlement_type/remark 字段，修复详情页这些字段显示为空的 Bug
  const member = await queryOneWithTenant<MemberDetailRow>(
    `SELECT m.id AS memberId, m.name, m.contact, m.mobile, m.customer_type AS customerType,
    m.address, m.settlement_type AS settlementType, m.remark,
    m.points, m.level_code AS levelCode, m.status,
    m.staff_id AS staffId, u.real_name AS staffName
     FROM t_member m
     LEFT JOIN t_sys_user u ON u.id = m.staff_id
     WHERE m.id = ? AND m.tenant_id = ? `,
    [memberId, tenantId],
    tenantId
  );
  if (!member) {
    throw Object.assign(new Error("客户不存在"), { statusCode: 404 });
  }
  return member;
}

export async function updateCustomer(tenantId: string, memberId: number, body: { name?: string; mobile?: string; address?: string; customerType?: string; levelCode?: string; settlementType?: string; remark?: string; contact?: string }) {
  const existing = await queryOneWithTenant<MemberBasicRow>("SELECT id, name, mobile FROM t_member WHERE id = ? AND tenant_id = ?", [memberId, tenantId], tenantId);
  if (!existing) {
    throw Object.assign(new Error("客户不存在"), { statusCode: 404 });
  }
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
  if (body.contact !== undefined) { sets.push("contact = ?"); params.push(body.contact); }
  if (body.mobile !== undefined) { sets.push("mobile = ?"); params.push(body.mobile); }
  if (body.address !== undefined) { sets.push("address = ?"); params.push(body.address); }
  if (body.customerType !== undefined) { sets.push("customer_type = ?"); params.push(body.customerType); }
  if (body.levelCode !== undefined) { sets.push("level_code = ?"); params.push(body.levelCode); }
  if (body.settlementType !== undefined) { sets.push("settlement_type = ?"); params.push(body.settlementType); }
  if (body.remark !== undefined) { sets.push("remark = ?"); params.push(body.remark); }
  if (sets.length === 0) { return { memberId }; }
  sets.push("updated_at = NOW()");
  params.push(memberId, tenantId);
  await queryWithTenant(`UPDATE t_member SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ? `, params, tenantId);

  // 分字段定向同步：客户名称/电话变更同步到销售单
  const changedFields = detectChangedFields(
    { name: existing.name, mobile: existing.mobile },
    { name: body.name, mobile: body.mobile }
  );
  if (changedFields.length > 0) {
    syncChangedFields("member", memberId, changedFields, tenantId).catch(() => { });
  }

  return { memberId };
}

export async function disableCustomer(tenantId: string, memberId: number) {
  const existing = await queryOneWithTenant<MemberStatusRow>("SELECT id, name, status FROM t_member WHERE id = ? AND tenant_id = ?", [memberId, tenantId], tenantId);
  if (!existing) {
    throw Object.assign(new Error("客户不存在"), { statusCode: 404 });
  }
  if (existing.status === "INACTIVE") {
    throw Object.assign(new Error("客户已停用"), { statusCode: 400 });
  }
  await queryWithTenant("UPDATE t_member SET status = 'INACTIVE', updated_at = NOW() WHERE id = ? AND tenant_id = ?", [memberId, tenantId], tenantId);
  return { memberId, name: existing.name };
}

export async function assignStaffToCustomer(tenantId: string, memberId: number, staffId: number) {
  const member = await queryOneWithTenant<IdRow>("SELECT id FROM t_member WHERE id = ? AND tenant_id = ?", [memberId, tenantId], tenantId);
  if (!member) {
    throw Object.assign(new Error("客户不存在"), { statusCode: 404 });
  }
  const staff = await queryOneWithTenant<IdRow>("SELECT id FROM t_sys_user WHERE id = ? AND status = 1", [staffId], tenantId);
  if (!staff) {
    throw Object.assign(new Error("员工不存在"), { statusCode: 404 });
  }
  await queryWithTenant("UPDATE t_member SET staff_id = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?", [staffId, memberId, tenantId], tenantId);
  return { memberId, staffId };
}

export async function getCustomerPriceHistory(tenantId: string, memberId: number, skuId: number) {
  const records = await queryWithTenant<CustomerPriceRow>(
    `SELECT sbi.sku_id AS skuId, sbi.sku_name AS skuName, sbi.unit_price AS unitPrice,
    sb.bill_no AS billNo, sb.created_at AS createdAt
     FROM t_sale_bill_item sbi
     JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no
     WHERE sb.customer_id = ? AND sbi.sku_id = ? AND sb.tenant_id = ?
    ORDER BY sb.created_at DESC`,
    [memberId, skuId, tenantId],
    tenantId
  );
  if (records.length === 0) {
    return [];
  }
  const prices = records.map((r) => Number(r.unitPrice));
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
  const records = await queryWithTenant<CustomerSaleBillRow>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_name AS customerName,
    customer_mobile AS customerMobile, customer_type AS customerType,
    receivable_amount AS receivableAmount, received_amount AS receivedAmount,
    unreceived_amount AS unreceivedAmount,
    collection_status AS collectionStatus, business_status AS businessStatus,
    created_at AS createdAt
     FROM t_sale_bill
     WHERE customer_id = ? AND tenant_id = ?
    ORDER BY created_at DESC
     LIMIT ? OFFSET ? `,
    [memberId, tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>("SELECT COUNT(*) AS total FROM t_sale_bill WHERE customer_id = ? AND tenant_id = ?", [memberId, tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listCustomerPayments(tenantId: string, memberId: number, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<CustomerPaymentRow>(
    `SELECT id, receipt_no AS receiptNo, source_type AS sourceType, source_no AS sourceNo,
    customer_id AS customerId, customer_name AS customerName,
    amount, payment_method AS paymentMethod,
    voucher_no AS voucherNo, payment_date AS paymentDate,
    status, remark, created_at AS createdAt, 'SALE_PAYMENT' AS paymentTable
     FROM t_sale_payment
     WHERE customer_id = ? AND tenant_id = ?
    UNION ALL
     SELECT id, receipt_no AS receiptNo, source_type AS sourceType, source_no AS sourceNo,
    customer_id AS customerId, customer_name AS customerName,
    amount, payment_method AS paymentMethod,
    voucher_no AS voucherNo, payment_date AS paymentDate,
    status, remark, created_at AS createdAt, 'CUSTOMER_PAYMENT' AS paymentTable
     FROM t_customer_payment
     WHERE customer_id = ? AND tenant_id = ?
    ORDER BY created_at DESC
     LIMIT ? OFFSET ? `,
    [memberId, tenantId, memberId, tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT
        (SELECT COUNT(*) FROM t_sale_payment WHERE customer_id = ? AND tenant_id = ?) +
        (SELECT COUNT(*) FROM t_customer_payment WHERE customer_id = ? AND tenant_id = ?) AS total`,
    [memberId, tenantId, memberId, tenantId],
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listCustomerStatements(tenantId: string, memberId: number, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<CustomerStatementRow>(
    `SELECT id, statement_no AS statementNo, customer_id AS customerId, customer_name AS customerName,
    statement_type AS statementType, start_date AS startDate, end_date AS endDate,
      opening_balance AS openingBalance, total_sales AS totalSales,
        total_returns AS totalReturns, total_payments AS totalPayments,
          closing_balance AS closingBalance,
            status, confirmed_at AS confirmedAt, created_at AS createdAt
     FROM t_customer_statement
     WHERE customer_id = ? AND tenant_id = ?
    ORDER BY created_at DESC
  LIMIT ? OFFSET ? `,
    [memberId, tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>(
    "SELECT COUNT(*) AS total FROM t_customer_statement WHERE customer_id = ? AND tenant_id = ?",
    [memberId, tenantId],
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function getCustomerPurchaseStats(tenantId: string, memberId: number) {
  const billStats = await queryOneWithTenant<PurchaseStatsRow>(
    `SELECT COUNT(*) AS billCount,
    COALESCE(SUM(receivable_amount), 0) AS totalAmount,
      COALESCE(SUM(received_amount), 0) AS receivedAmount,
        COALESCE(SUM(unreceived_amount), 0) AS unpaidAmount
     FROM t_sale_bill
     WHERE customer_id = ? AND tenant_id = ? AND business_status NOT IN('DRAFT', 'VOIDED')`,
    [memberId, tenantId],
    tenantId
  );

  const topProducts = await queryWithTenant<TopProductRow>(
    `SELECT sbi.sku_id AS skuId, sbi.sku_name AS skuName,
    SUM(sbi.total_bottle_qty) AS totalQty,
      SUM(sbi.subtotal_amount) AS totalAmount
     FROM t_sale_bill_item sbi
     JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no
     WHERE sb.customer_id = ? AND sb.tenant_id = ? AND sb.business_status NOT IN('DRAFT', 'VOIDED')
     GROUP BY sbi.sku_id, sbi.sku_name
     ORDER BY totalQty DESC
     LIMIT 10`,
    [memberId, tenantId],
    tenantId
  );

  const lastOrder = await queryOneWithTenant<LastOrderRow>(
    `SELECT MAX(created_at) AS lastOrderAt FROM t_sale_bill WHERE customer_id = ? AND tenant_id = ? AND business_status NOT IN('DRAFT', 'VOIDED')`,
    [memberId, tenantId],
    tenantId
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
  const totalRow = await queryOneWithTenant<CountTotalRow>("SELECT COUNT(*) AS total FROM t_member WHERE status = 1 AND tenant_id = ?", [tenantId], tenantId);
  const newMonthRow = await queryOneWithTenant<CountCntRow>(
    "SELECT COUNT(*) AS cnt FROM t_member WHERE status = 1 AND tenant_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')",
    [tenantId],
    tenantId
  );
  const activeRow = await queryOneWithTenant<CountCntRow>(
    `SELECT COUNT(DISTINCT customer_id) AS cnt
     FROM t_sale_bill
     WHERE customer_id IS NOT NULL
       AND tenant_id = ?
    AND business_status NOT IN('DRAFT', 'VOIDED')
       AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    [tenantId],
    tenantId
  );
  const debtRow = await queryOneWithTenant<CountCntRow>(
    `SELECT COUNT(DISTINCT customer_id) AS cnt
     FROM t_sale_bill
     WHERE customer_id IS NOT NULL
       AND tenant_id = ?
    AND unreceived_amount > 0
       AND business_status NOT IN('DRAFT', 'VOIDED')`,
    [tenantId],
    tenantId
  );
  const receivableRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COALESCE(SUM(unreceived_amount), 0) AS total
     FROM t_sale_bill
     WHERE customer_id IS NOT NULL
       AND tenant_id = ?
    AND unreceived_amount > 0
       AND business_status NOT IN('DRAFT', 'VOIDED')`,
    [tenantId],
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    newThisMonth: Number(newMonthRow?.cnt ?? 0),
    activeCount: Number(activeRow?.cnt ?? 0),
    debtCount: Number(debtRow?.cnt ?? 0),
    totalReceivable: Number(receivableRow?.total ?? 0)
  };
}
