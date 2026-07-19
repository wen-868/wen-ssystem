import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

export async function createReceipt(params: { customerId: number; customerName?: string; receiptType: string; amount: number; paymentMethod?: string; bankAccountId?: number; receivedDate?: string; remark?: string; operatorId: number; tenantId: string }) {
  const { customerId, customerName, receiptType, amount, paymentMethod, bankAccountId, receivedDate, remark, operatorId, tenantId } = params;
  const receiptNo = makeBizNo("SK");
  await queryWithTenant(
    `INSERT INTO t_receipt (receipt_no, customer_id, customer_name, receipt_type, amount, payment_method, bank_account_id, received_date, remark, operator_id, status, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?)`,
    [receiptNo, customerId, customerName ?? null, receiptType ?? "SALE", amount, paymentMethod ?? null, bankAccountId ?? null, receivedDate ?? null, remark ?? null, operatorId, tenantId], tenantId
  );
  return { receiptNo, customerId, amount, status: "CONFIRMED" };
}

export async function listReceipts(params: { customerId?: number; status?: string; page: number; pageSize: number; tenantId: string }) {
  const { customerId, status, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions = ["tenant_id = ?"]; const values: unknown[] = [tenantId];
  if (customerId !== undefined) { conditions.push("customer_id = ?"); values.push(customerId); }
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<any>(
    `SELECT receipt_no AS receiptNo, customer_id AS customerId, customer_name AS customerName, receipt_type AS receiptType, amount, payment_method AS paymentMethod, bank_account_id AS bankAccountId, received_date AS receivedDate, status, remark, operator_id AS operatorId, created_at AS createdAt
     FROM t_receipt ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS total FROM t_receipt ${where}`, values, tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}

export async function getReceiptDetail(receiptNo: string, tenantId: string) {
  const receipt = await queryOneWithTenant<any>(
    "SELECT receipt_no AS receiptNo, customer_id AS customerId, customer_name AS customerName, receipt_type AS receiptType, amount, payment_method AS paymentMethod, bank_account_id AS bankAccountId, received_date AS receivedDate, status, remark, operator_id AS operatorId, created_at AS createdAt FROM t_receipt WHERE receipt_no = ? AND tenant_id = ?",
    [receiptNo, tenantId], tenantId
  );
  if (!receipt) throw new Error("收款单不存在");
  const writeoffs = await queryWithTenant<any>(
    "SELECT rw.id, rw.receivable_id AS receivableId, r.source_no AS sourceNo, rw.writeoff_amount AS writeoffAmount, rw.created_at AS createdAt FROM t_receipt_writeoff rw LEFT JOIN receivable r ON r.id = rw.receivable_id WHERE rw.receipt_id = (SELECT id FROM t_receipt WHERE receipt_no = ? AND tenant_id = ?)",
    [receiptNo, tenantId], tenantId
  );
  return { ...receipt, writeoffs };
}

export async function writeoffReceipt(receiptNo: string, receivableId: number, writeoffAmount: number, tenantId: string) {
  const receipt = await queryOneWithTenant<any>("SELECT id, amount, status FROM t_receipt WHERE receipt_no = ? AND tenant_id = ?", [receiptNo, tenantId], tenantId);
  if (!receipt) throw new Error("收款单不存在");
  if (receipt.status !== "CONFIRMED") throw new Error("只有已确认的收款单可以核销");
  const ar = await queryOneWithTenant<any>("SELECT id, balance FROM t_receivable WHERE id = ? AND tenant_id = ?", [receivableId, tenantId], tenantId);
  if (!ar) throw new Error("应收记录不存在");
  if (Number(ar.balance) < writeoffAmount) throw new Error("核销金额不能超过应收余额");
  await queryWithTenant("INSERT INTO t_receipt_writeoff (receipt_id, receivable_id, writeoff_amount, tenant_id) VALUES (?, ?, ?, ?)", [receipt.id, receivableId, writeoffAmount, tenantId], tenantId);
  const newBalance = Number(ar.balance) - writeoffAmount;
  const newStatus = newBalance <= 0 ? "PAID" : "PARTIAL";
  await queryWithTenant("UPDATE t_receivable SET received_amount = received_amount + ?, balance = ?, status = ? WHERE id = ? AND tenant_id = ?", [writeoffAmount, newBalance, newStatus, receivableId, tenantId], tenantId);
  return { receiptNo, receivableId, writeoffAmount, balanceAfter: newBalance };
}

export async function voidReceipt(receiptNo: string, tenantId: string) {
  const receipt = await queryOneWithTenant<any>("SELECT id, status FROM t_receipt WHERE receipt_no = ? AND tenant_id = ?", [receiptNo, tenantId], tenantId);
  if (!receipt) throw new Error("收款单不存在");
  if (receipt.status === "VOIDED") throw new Error("收款单已作废");
  // 回退核销
  const writeoffs = await queryWithTenant<any>("SELECT receivable_id, writeoff_amount FROM t_receipt_writeoff WHERE receipt_id = ? AND tenant_id = ?", [receipt.id, tenantId], tenantId);
  for (const wo of writeoffs) {
    await queryWithTenant("UPDATE t_receivable SET received_amount = received_amount - ?, balance = balance + ?, status = CASE WHEN balance + ? >= receivable_amount THEN 'PAID' WHEN received_amount > 0 THEN 'PARTIAL' ELSE 'PENDING' END WHERE id = ? AND tenant_id = ?", [wo.writeoff_amount, wo.writeoff_amount, wo.writeoff_amount, wo.receivable_id, tenantId], tenantId);
  }
  await queryWithTenant("DELETE FROM t_receipt_writeoff WHERE receipt_id = ? AND tenant_id = ?", [receipt.id, tenantId], tenantId);
  await queryWithTenant("UPDATE t_receipt SET status = 'VOIDED' WHERE id = ? AND tenant_id = ?", [receipt.id, tenantId], tenantId);
  return { receiptNo, status: "VOIDED" };
}

// 自动生成应收（销售单创建时调用）
export async function generateReceivable(billNo: string, customerId: number, customerName: string, amount: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>("SELECT id FROM t_receivable WHERE source_no = ? AND tenant_id = ?", [billNo, tenantId], tenantId);
  if (existing) return null;
  await queryWithTenant(
    "INSERT INTO t_receivable (customer_id, customer_name, source_type, source_no, receivable_amount, received_amount, balance, status, tenant_id) VALUES (?, ?, 'SALE_BILL', ?, ?, 0, ?, 'PENDING', ?)",
    [customerId, customerName ?? null, billNo, amount, amount, tenantId], tenantId
  );
  return { billNo, customerId, amount };
}