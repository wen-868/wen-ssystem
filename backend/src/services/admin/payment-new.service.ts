import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

export async function createPayment(params: { supplierId: number; supplierName?: string; paymentType: string; amount: number; paymentMethod?: string; bankAccountId?: number; paidDate?: string; remark?: string; operatorId: number; tenantId: string }) {
  const { supplierId, supplierName, paymentType, amount, paymentMethod, bankAccountId, paidDate, remark, operatorId, tenantId } = params;
  const paymentNo = makeBizNo("FK");
  await queryWithTenant(
    `INSERT INTO payment (payment_no, supplier_id, supplier_name, payment_type, amount, payment_method, bank_account_id, paid_date, remark, operator_id, status, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?)`,
    [paymentNo, supplierId, supplierName ?? null, paymentType ?? "PURCHASE", amount, paymentMethod ?? null, bankAccountId ?? null, paidDate ?? null, remark ?? null, operatorId, tenantId], tenantId
  );
  return { paymentNo, supplierId, amount, status: "CONFIRMED" };
}

export async function listPayments(params: { supplierId?: number; paymentType?: string; status?: string; page: number; pageSize: number; tenantId: string }) {
  const { supplierId, paymentType, status, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions = ["tenant_id = ?"]; const values: unknown[] = [tenantId];
  if (supplierId !== undefined) { conditions.push("supplier_id = ?"); values.push(supplierId); }
  if (paymentType) { conditions.push("payment_type = ?"); values.push(paymentType); }
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<any>(
    `SELECT payment_no AS paymentNo, supplier_id AS supplierId, supplier_name AS supplierName, payment_type AS paymentType, amount, payment_method AS paymentMethod, bank_account_id AS bankAccountId, paid_date AS paidDate, status, remark, operator_id AS operatorId, created_at AS createdAt
     FROM payment ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS total FROM payment ${where}`, values, tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}

export async function getPaymentDetail(paymentNo: string, tenantId: string) {
  const payment = await queryOneWithTenant<any>(
    "SELECT payment_no AS paymentNo, supplier_id AS supplierId, supplier_name AS supplierName, payment_type AS paymentType, amount, payment_method AS paymentMethod, bank_account_id AS bankAccountId, paid_date AS paidDate, status, remark, operator_id AS operatorId, created_at AS createdAt FROM payment WHERE payment_no = ? AND tenant_id = ?",
    [paymentNo, tenantId], tenantId
  );
  if (!payment) throw new Error("付款单不存在");
  const writeoffs = await queryWithTenant<any>(
    "SELECT pw.id, pw.payable_id AS payableId, p.source_no AS sourceNo, pw.writeoff_amount AS writeoffAmount, pw.created_at AS createdAt FROM payment_writeoff pw LEFT JOIN payable p ON p.id = pw.payable_id WHERE pw.payment_id = (SELECT id FROM payment WHERE payment_no = ? AND tenant_id = ?)",
    [paymentNo, tenantId], tenantId
  );
  return { ...payment, writeoffs };
}

export async function writeoffPayment(paymentNo: string, payableId: number, writeoffAmount: number, tenantId: string) {
  const payment = await queryOneWithTenant<any>("SELECT id, amount, status FROM payment WHERE payment_no = ? AND tenant_id = ?", [paymentNo, tenantId], tenantId);
  if (!payment) throw new Error("付款单不存在");
  if (payment.status !== "CONFIRMED") throw new Error("只有已确认的付款单可以核销");
  const ap = await queryOneWithTenant<any>("SELECT id, balance FROM payable WHERE id = ? AND tenant_id = ?", [payableId, tenantId], tenantId);
  if (!ap) throw new Error("应付记录不存在");
  if (Number(ap.balance) < writeoffAmount) throw new Error("核销金额不能超过应付余额");
  await queryWithTenant("INSERT INTO payment_writeoff (payment_id, payable_id, writeoff_amount, tenant_id) VALUES (?, ?, ?, ?)", [payment.id, payableId, writeoffAmount, tenantId], tenantId);
  const newBalance = Number(ap.balance) - writeoffAmount;
  const newStatus = newBalance <= 0 ? "PAID" : "PARTIAL";
  await queryWithTenant("UPDATE payable SET paid_amount = paid_amount + ?, balance = ?, status = ? WHERE id = ? AND tenant_id = ?", [writeoffAmount, newBalance, newStatus, payableId, tenantId], tenantId);
  return { paymentNo, payableId, writeoffAmount, balanceAfter: newBalance };
}

export async function voidPayment(paymentNo: string, tenantId: string) {
  const payment = await queryOneWithTenant<any>("SELECT id, status FROM payment WHERE payment_no = ? AND tenant_id = ?", [paymentNo, tenantId], tenantId);
  if (!payment) throw new Error("付款单不存在");
  if (payment.status === "VOIDED") throw new Error("付款单已作废");
  const writeoffs = await queryWithTenant<any>("SELECT payable_id, writeoff_amount FROM payment_writeoff WHERE payment_id = ? AND tenant_id = ?", [payment.id, tenantId], tenantId);
  for (const wo of writeoffs) {
    await queryWithTenant("UPDATE payable SET paid_amount = paid_amount - ?, balance = balance + ?, status = CASE WHEN balance + ? >= payable_amount THEN 'PAID' WHEN paid_amount > 0 THEN 'PARTIAL' ELSE 'PENDING' END WHERE id = ? AND tenant_id = ?", [wo.writeoff_amount, wo.writeoff_amount, wo.writeoff_amount, wo.payable_id, tenantId], tenantId);
  }
  await queryWithTenant("DELETE FROM payment_writeoff WHERE payment_id = ? AND tenant_id = ?", [payment.id, tenantId], tenantId);
  await queryWithTenant("UPDATE payment SET status = 'VOIDED' WHERE id = ? AND tenant_id = ?", [payment.id, tenantId], tenantId);
  return { paymentNo, status: "VOIDED" };
}

// 自动生成应付
export async function generatePayable(orderNo: string, supplierId: number, supplierName: string, amount: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>("SELECT id FROM payable WHERE source_no = ? AND tenant_id = ?", [orderNo, tenantId], tenantId);
  if (existing) return null;
  await queryWithTenant(
    "INSERT INTO payable (supplier_id, supplier_name, source_type, source_no, payable_amount, paid_amount, balance, status, tenant_id) VALUES (?, ?, 'PURCHASE_ORDER', ?, ?, 0, ?, 'PENDING', ?)",
    [supplierId, supplierName ?? null, orderNo, amount, amount, tenantId], tenantId
  );
  return { orderNo, supplierId, amount };
}