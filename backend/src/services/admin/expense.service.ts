import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

export async function createExpense(params: { expenseType: string; category?: string; amount: number; payee?: string; paymentMethod?: string; bankAccountId?: number; invoiceNo?: string; expenseDate?: string; remark?: string; operatorId: number; tenantId: string }) {
  const { expenseType, category, amount, payee, paymentMethod, bankAccountId, invoiceNo, expenseDate, remark, operatorId, tenantId } = params;
  const expenseNo = makeBizNo("FY");
  await queryWithTenant(
    `INSERT INTO t_expense (expense_no, expense_type, category, amount, payee, payment_method, bank_account_id, invoice_no, expense_date, remark, operator_id, status, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,'PENDING', ?)`,
    [expenseNo, expenseType ?? "DAILY", category ?? null, amount, payee ?? null, paymentMethod ?? null, bankAccountId ?? null, invoiceNo ?? null, expenseDate ?? null, remark ?? null, operatorId ?? null, tenantId], tenantId
  );
  return { expenseNo, expenseType, amount, status: "PENDING" };
}

export async function listExpenses(params: { expenseType?: string; status?: string; page: number; pageSize: number; tenantId: string }) {
  const { expenseType, status, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions = ["tenant_id = ?"]; const values: unknown[] = [tenantId];
  if (expenseType) { conditions.push("expense_type = ?"); values.push(expenseType); }
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<any>(
    `SELECT expense_no AS expenseNo, expense_type AS expenseType, category, amount, payee, payment_method AS paymentMethod, bank_account_id AS bankAccountId, invoice_no AS invoiceNo, expense_date AS expenseDate, status, remark, operator_id AS operatorId, created_at AS createdAt
     FROM t_expense ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS total FROM t_expense ${where}`, values, tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}

export async function getExpenseDetail(expenseNo: string, tenantId: string) {
  const expense = await queryOneWithTenant<any>("SELECT * FROM t_expense WHERE expense_no = ? AND tenant_id = ?", [expenseNo, tenantId], tenantId);
  if (!expense) throw new Error("费用不存在");
  return expense;
}

export async function updateExpense(expenseNo: string, params: { expenseType?: string; category?: string; amount?: number; payee?: string; paymentMethod?: string; expenseDate?: string; remark?: string; tenantId: string }) {
  const fields: string[] = []; const values: unknown[] = [];
  if (params.expenseType !== undefined) { fields.push("expense_type = ?"); values.push(params.expenseType); }
  if (params.category !== undefined) { fields.push("category = ?"); values.push(params.category); }
  if (params.amount !== undefined) { fields.push("amount = ?"); values.push(params.amount); }
  if (params.payee !== undefined) { fields.push("payee = ?"); values.push(params.payee); }
  if (params.paymentMethod !== undefined) { fields.push("payment_method = ?"); values.push(params.paymentMethod); }
  if (params.expenseDate !== undefined) { fields.push("expense_date = ?"); values.push(params.expenseDate); }
  if (params.remark !== undefined) { fields.push("remark = ?"); values.push(params.remark); }
  if (fields.length === 0) throw new Error("没有需要更新的字段");
  values.push(expenseNo, params.tenantId);
  await queryWithTenant(`UPDATE t_expense SET ${fields.join(", ")} WHERE expense_no = ? AND tenant_id = ?`, values, params.tenantId);
  return { expenseNo, ...params };
}

export async function approveExpense(expenseNo: string, tenantId: string) {
  const expense = await queryOneWithTenant<any>("SELECT expense_no, status FROM t_expense WHERE expense_no = ? AND tenant_id = ?", [expenseNo, tenantId], tenantId);
  if (!expense) throw new Error("费用不存在");
  if (expense.status !== "PENDING") throw new Error("只有待审批的费用可以审批");
  await queryWithTenant("UPDATE t_expense SET status = 'APPROVED' WHERE expense_no = ? AND tenant_id = ?", [expenseNo, tenantId], tenantId);
  return { expenseNo, status: "APPROVED" };
}

export async function voidExpense(expenseNo: string, tenantId: string) {
  const expense = await queryOneWithTenant<any>("SELECT expense_no, status FROM t_expense WHERE expense_no = ? AND tenant_id = ?", [expenseNo, tenantId], tenantId);
  if (!expense) throw new Error("费用不存在");
  if (expense.status === "VOIDED") throw new Error("费用已作废");
  await queryWithTenant("UPDATE t_expense SET status = 'VOIDED' WHERE expense_no = ? AND tenant_id = ?", [expenseNo, tenantId], tenantId);
  return { expenseNo, status: "VOIDED" };
}

export async function getExpenseSummary(tenantId: string, startDate?: string, endDate?: string) {
  const conditions = ["tenant_id = ?", "status != 'VOIDED'"]; const values: unknown[] = [tenantId];
  if (startDate) { conditions.push("expense_date >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("expense_date <= ?"); values.push(endDate); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const byCategory = await queryWithTenant<any>(
    `SELECT expense_type AS expenseType, COALESCE(SUM(amount), 0) AS totalAmount, COUNT(*) AS cnt
     FROM t_expense ${where} GROUP BY expense_type ORDER BY totalAmount DESC`,
    values, tenantId
  );
  const totalAmount = await queryOneWithTenant<any>(`SELECT COALESCE(SUM(amount), 0) AS total FROM t_expense ${where}`, values, tenantId);
  return { totalAmount: totalAmount?.total ?? 0, byCategory };
}