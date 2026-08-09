import { query, queryOne, queryWithTenant } from "../../shared/db";
import { AppError } from "../../shared/app-error";

/**
 * 商用化补全服务（R100）：补齐前端已实现但后端缺失的 5 类接口
 * - 资金流水（t_cash_flow）
 * - 提成统计（t_sales_commission_record）
 * - 后台收货地址（t_retail_consumer_address）
 * - 票据管理（t_bill，126 迁移建表）
 * - 优惠券核销记录（t_user_coupon）
 */

// ==================== 1. 资金流水 ====================
export async function listFundTransactions(tenantId: string, params: {
  page?: number; pageSize?: number; transactionType?: string; dateStart?: string; dateEnd?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const where: string[] = ["tenant_id = ?"];
  const args: unknown[] = [tenantId];
  if (params.transactionType === "INCOME" || params.transactionType === "EXPENSE") {
    where.push(params.transactionType === "INCOME" ? "amount > 0" : "amount < 0");
  }
  if (params.dateStart) { where.push("transaction_date >= ?"); args.push(params.dateStart); }
  if (params.dateEnd) { where.push("transaction_date <= ?"); args.push(params.dateEnd); }
  const whereSql = where.join(" AND ");
  const totalRow = await queryOne<{ total: number }>(`SELECT COUNT(*) AS total FROM t_cash_flow WHERE ${whereSql}`, args);
  const rows = await query<CashFlowRow>(
    `SELECT id, related_no, transaction_type, transaction_date, amount, balance_after, remark, created_at
     FROM t_cash_flow WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize]
  );
  const records = rows.map((r) => ({
    id: r.id,
    transactionNo: r.related_no || `CF${String(r.id).padStart(8, "0")}`,
    transactionType: Number(r.amount) >= 0 ? "INCOME" : "EXPENSE",
    amount: Math.abs(Number(r.amount)),
    balance: r.balance_after,
    accountName: "现金账户",
    remark: r.remark || "",
    createdAt: r.created_at,
  }));
  return { records, total: totalRow?.total ?? 0, page, pageSize };
}

export async function getFundStatistics(tenantId: string, params: { dateStart?: string; dateEnd?: string }) {
  const where: string[] = ["tenant_id = ?"];
  const args: unknown[] = [tenantId];
  if (params.dateStart) { where.push("transaction_date >= ?"); args.push(params.dateStart); }
  if (params.dateEnd) { where.push("transaction_date <= ?"); args.push(params.dateEnd); }
  const whereSql = where.join(" AND ");
  const stat = await queryOne<{ totalIncome: number; totalExpense: number; count: number }>(
    `SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS totalIncome,
            COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS totalExpense,
            COUNT(*) AS count
     FROM t_cash_flow WHERE ${whereSql}`,
    args
  );
  const daily = await query<{ date: string; income: number; expense: number }>(
    `SELECT transaction_date AS date,
            COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS expense
     FROM t_cash_flow WHERE ${whereSql} GROUP BY transaction_date ORDER BY transaction_date DESC LIMIT 30`,
    args
  );
  return {
    totalIncome: stat?.totalIncome ?? 0,
    totalExpense: stat?.totalExpense ?? 0,
    netIncome: (stat?.totalIncome ?? 0) - (stat?.totalExpense ?? 0),
    transactionCount: stat?.count ?? 0,
    list: daily.map((d) => ({ date: d.date, income: d.income, expense: d.expense, net: d.income - d.expense })),
  };
}

// ==================== 2. 提成统计 ====================
export async function getCommissionStats(tenantId: string) {
  const stat = await queryOne<{
    totalCount: number; totalAmount: number; pendingAmount: number; settledAmount: number; monthAmount: number;
  }>(
    `SELECT COUNT(*) AS totalCount,
            COALESCE(SUM(commission_amount), 0) AS totalAmount,
            COALESCE(SUM(CASE WHEN status = 'PENDING' THEN commission_amount ELSE 0 END), 0) AS pendingAmount,
            COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN commission_amount ELSE 0 END), 0) AS settledAmount,
            COALESCE(SUM(CASE WHEN DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m') THEN commission_amount ELSE 0 END), 0) AS monthAmount
     FROM t_sales_commission_record WHERE tenant_id = ?`,
    [tenantId]
  );
  return {
    totalCount: stat?.totalCount ?? 0,
    totalAmount: stat?.totalAmount ?? 0,
    pendingAmount: stat?.pendingAmount ?? 0,
    settledAmount: stat?.settledAmount ?? 0,
    monthAmount: stat?.monthAmount ?? 0,
  };
}

// ==================== 3. 后台收货地址 ====================
export async function listConsumerAddresses(tenantId: string, params: { page?: number; pageSize?: number; keyword?: string }) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const where: string[] = ["1 = 1"];
  const args: unknown[] = [];
  if (params.keyword) {
    where.push("(name LIKE ? OR mobile LIKE ? OR detail LIKE ?)");
    const kw = `%${params.keyword}%`;
    args.push(kw, kw, kw);
  }
  const whereSql = where.join(" AND ");
  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_retail_consumer_address WHERE ${whereSql}`,
    args
  );
  const rows = await query<ConsumerAddressRow>(
    `SELECT id, user_id, name, mobile, province, city, district, detail, is_default, created_at
     FROM t_retail_consumer_address WHERE ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize]
  );
  return {
    records: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      mobile: r.mobile,
      province: r.province,
      city: r.city,
      district: r.district,
      detail: r.detail,
      address: `${r.province || ""}${r.city || ""}${r.district || ""}${r.detail || ""}`,
      isDefault: !!r.is_default,
      createdAt: r.created_at,
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function deleteConsumerAddress(tenantId: string, id: number) {
  const result = (await query("DELETE FROM t_retail_consumer_address WHERE id = ?", [id])) as unknown as { affectedRows: number };
  if (!result.affectedRows) throw new AppError("收货地址不存在", 404);
  return { success: true };
}

// ==================== 4. 票据管理 ====================
export async function listBills(tenantId: string, params: {
  page?: number; pageSize?: number; keyword?: string; billType?: string; status?: string; dateStart?: string; dateEnd?: string;
}) {
  await ensureBillTable();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const where: string[] = ["tenant_id = ?"];
  const args: unknown[] = [tenantId];
  if (params.keyword) { where.push("(bill_no LIKE ? OR remark LIKE ?)"); const kw = `%${params.keyword}%`; args.push(kw, kw); }
  if (params.billType) { where.push("bill_type = ?"); args.push(params.billType); }
  if (params.status) { where.push("status = ?"); args.push(params.status); }
  if (params.dateStart) { where.push("issue_date >= ?"); args.push(params.dateStart); }
  if (params.dateEnd) { where.push("issue_date <= ?"); args.push(params.dateEnd); }
  const whereSql = where.join(" AND ");
  let totalRow: { total: number } | null = null;
  let rows: BillRow[] = [];
  try {
    totalRow = await queryOne<{ total: number }>(`SELECT COUNT(*) AS total FROM t_bill WHERE ${whereSql}`, args);
    rows = await query<BillRow>(
      `SELECT id, bill_no, bill_type, amount, issue_date, due_date, status, verified_at, remark, created_at
       FROM t_bill WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...args, pageSize, (page - 1) * pageSize]
    );
  } catch {
    // 表尚未初始化（无建表权限或未执行迁移）时返回空列表，不报 500
    return { records: [], total: 0, page, pageSize, warning: "票据表未初始化，请先执行迁移 docs/migrations/126_bills.sql" };
  }
  return {
    records: rows.map((r) => ({
      id: r.id,
      billNo: r.bill_no,
      billType: r.bill_type,
      amount: r.amount,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      status: r.status,
      verifiedAt: r.verified_at,
      remark: r.remark,
      createdAt: r.created_at,
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function createBill(tenantId: string, body: {
  billNo?: string; billType: string; amount: number; issueDate?: string; dueDate?: string; remark?: string;
}) {
  await ensureBillTable();
  const billNo = body.billNo || `BILL${Date.now()}`;
  const insert = (await query(
    `INSERT INTO t_bill (tenant_id, bill_no, bill_type, amount, issue_date, due_date, status, remark)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
    [tenantId, billNo, body.billType, body.amount || 0, body.issueDate || null, body.dueDate || null, body.remark || null]
  )) as unknown as { insertId: number };
  return { id: insert.insertId, billNo };
}

export async function updateBill(tenantId: string, id: number, body: {
  billNo?: string; billType?: string; amount?: number; issueDate?: string; dueDate?: string; remark?: string;
}) {
  await ensureBillTable();
  const sets: string[] = [];
  const args: unknown[] = [];
  if (body.billNo !== undefined) { sets.push("bill_no = ?"); args.push(body.billNo); }
  if (body.billType !== undefined) { sets.push("bill_type = ?"); args.push(body.billType); }
  if (body.amount !== undefined) { sets.push("amount = ?"); args.push(body.amount); }
  if (body.issueDate !== undefined) { sets.push("issue_date = ?"); args.push(body.issueDate || null); }
  if (body.dueDate !== undefined) { sets.push("due_date = ?"); args.push(body.dueDate || null); }
  if (body.remark !== undefined) { sets.push("remark = ?"); args.push(body.remark); }
  if (!sets.length) return { success: true };
  sets.push("updated_at = NOW()");
  args.push(id, tenantId);
  await query(`UPDATE t_bill SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, args);
  return { success: true };
}

export async function deleteBill(tenantId: string, id: number) {
  await ensureBillTable();
  const result = (await query("DELETE FROM t_bill WHERE id = ? AND tenant_id = ?", [id, tenantId])) as unknown as { affectedRows: number };
  if (!result.affectedRows) throw new AppError("票据不存在", 404);
  return { success: true };
}

export async function verifyBill(tenantId: string, id: number) {
  await ensureBillTable();
  const result = (await query(
    "UPDATE t_bill SET status = 'VERIFIED', verified_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ? AND status = 'PENDING'",
    [id, tenantId]
  )) as unknown as { affectedRows: number };
  if (!result.affectedRows) throw new AppError("票据不存在或已处理", 400);
  return { success: true };
}

export async function voidBill(tenantId: string, id: number) {
  await ensureBillTable();
  const result = (await query(
    "UPDATE t_bill SET status = 'VOID', updated_at = NOW() WHERE id = ? AND tenant_id = ? AND status = 'PENDING'",
    [id, tenantId]
  )) as unknown as { affectedRows: number };
  if (!result.affectedRows) throw new AppError("票据不存在或已处理", 400);
  return { success: true };
}

/** 确保票据表存在（126 迁移；此处兜底防部署顺序问题） */
async function ensureBillTable() {
  try {
    await query(
      `CREATE TABLE IF NOT EXISTS t_bill (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      tenant_id VARCHAR(36) NOT NULL,
      bill_no VARCHAR(64) NOT NULL,
      bill_type VARCHAR(16) NOT NULL DEFAULT 'INVOICE',
      amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      issue_date DATE DEFAULT NULL,
      due_date DATE DEFAULT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
      verified_at DATETIME DEFAULT NULL,
      remark VARCHAR(255) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_bill_no (bill_no, tenant_id),
      KEY idx_bill_tenant_status (tenant_id, status),
      KEY idx_bill_tenant_type (tenant_id, bill_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='票据管理表'`
    );
  } catch {
    // 建表权限不足时静默，由 migration 兜底
  }
}

// ==================== 5. 优惠券核销记录 ====================
export async function listCouponVerifyRecords(tenantId: string, params: { page?: number; pageSize?: number; status?: string }) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const where: string[] = ["uc.tenant_id = ?"];
  const args: unknown[] = [tenantId];
  if (params.status) { where.push("uc.status = ?"); args.push(params.status); }
  const whereSql = where.join(" AND ");
  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_user_coupon uc WHERE ${whereSql}`,
    args
  );
  const rows = await query<CouponRecordRow>(
    `SELECT uc.id, uc.coupon_no, uc.coupon_name, uc.coupon_type, uc.discount_amount, uc.status, uc.used_at,
            uc.used_order_no, m.name AS user_name, m.mobile AS user_mobile
     FROM t_user_coupon uc LEFT JOIN t_member m ON m.id = uc.user_id
     WHERE ${whereSql} ORDER BY uc.used_at DESC LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize]
  );
  return {
    records: rows.map((r) => ({
      id: r.id,
      couponCode: r.coupon_no,
      couponName: r.coupon_name,
      couponType: r.coupon_type,
      amount: r.discount_amount,
      verifyStatus: r.status === "USED" ? "VERIFIED" : r.status,
      verifiedAt: r.used_at,
      usedOrderNo: r.used_order_no,
      operatorName: r.user_name || "门店收银",
      userName: r.user_name,
      userMobile: r.user_mobile,
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  };
}

// ==================== 行类型 ====================
interface CashFlowRow {
  id: number; related_no: string | null; transaction_type: string;
  transaction_date: string; amount: number; balance_after: number; remark: string | null; created_at: string;
}
interface ConsumerAddressRow {
  id: number; user_id: number; name: string; mobile: string; province: string; city: string;
  district: string; detail: string; is_default: number; created_at: string;
}
interface BillRow {
  id: number; bill_no: string; bill_type: string; amount: number; issue_date: string | null;
  due_date: string | null; status: string; verified_at: string | null; remark: string | null; created_at: string;
}
interface CouponRecordRow {
  id: number; coupon_no: string; coupon_name: string; coupon_type: string; discount_amount: number;
  status: string; used_at: string | null; used_order_no: string | null; user_name: string | null; user_mobile: string | null;
}
