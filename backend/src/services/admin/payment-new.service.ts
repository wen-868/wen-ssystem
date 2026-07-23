import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

/** COUNT(*) AS total 通用返回 */
interface CountTotalRow {
  total: number;
}

/** SELECT id 通用返回 */
interface IdRow {
  id: number | string;
}

/** t_payment 付款单行（带别名） */
interface PaymentRow {
  paymentNo: string;
  supplierId: number | string;
  supplierName: string | null;
  paymentType: string;
  amount: number | string;
  paymentMethod: string | null;
  bankAccountId: number | string | null;
  paidDate: string | Date | null;
  status: string;
  remark: string | null;
  operatorId: number | string;
  createdAt: string | Date;
}

/** t_payment 仅 id+amount+status */
interface PaymentIdAmountStatusRow {
  id: number | string;
  amount: number | string;
  status: string;
}

/** t_payment 仅 id+status */
interface PaymentIdStatusRow {
  id: number | string;
  status: string;
}

/** t_payment_writeoff JOIN t_payable 核销明细行（带别名） */
interface PaymentWriteoffRow {
  id: number | string;
  payableId: number | string;
  sourceNo: string | null;
  writeoffAmount: number | string;
  createdAt: string | Date;
}

/** t_payment_writeoff 核销简查行（原始字段名） */
interface PaymentWriteoffSimpleRow {
  payable_id: number | string;
  writeoff_amount: number | string;
}

/** t_payable 仅 id+balance */
interface PayableIdBalanceRow {
  id: number | string;
  balance: number | string;
}

export async function createPayment(params: { supplierId: number; supplierName?: string; paymentType: string; amount: number; paymentMethod?: string; bankAccountId?: number; paidDate?: string; remark?: string; operatorId: number; tenantId: string }) {
  const { supplierId, supplierName, paymentType, amount, paymentMethod, bankAccountId, paidDate, remark, operatorId, tenantId } = params;
  const paymentNo = makeBizNo("FK");
  await queryWithTenant(
    `INSERT INTO t_payment (payment_no, supplier_id, supplier_name, payment_type, amount, payment_method, bank_account_id, paid_date, remark, operator_id, status, tenant_id)
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
  const records = await queryWithTenant<PaymentRow>(
    `SELECT payment_no AS paymentNo, supplier_id AS supplierId, supplier_name AS supplierName, payment_type AS paymentType, amount, payment_method AS paymentMethod, bank_account_id AS bankAccountId, paid_date AS paidDate, status, remark, operator_id AS operatorId, created_at AS createdAt
     FROM t_payment ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<CountTotalRow>(`SELECT COUNT(*) AS total FROM t_payment ${where}`, values, tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}

export async function getPaymentDetail(paymentNo: string, tenantId: string) {
  const payment = await queryOneWithTenant<PaymentRow>(
    "SELECT payment_no AS paymentNo, supplier_id AS supplierId, supplier_name AS supplierName, payment_type AS paymentType, amount, payment_method AS paymentMethod, bank_account_id AS bankAccountId, paid_date AS paidDate, status, remark, operator_id AS operatorId, created_at AS createdAt FROM t_payment WHERE payment_no = ? AND tenant_id = ?",
    [paymentNo, tenantId], tenantId
  );
  if (!payment) throw new Error("付款单不存在");
  const writeoffs = await queryWithTenant<PaymentWriteoffRow>(
    "SELECT pw.id, pw.payable_id AS payableId, p.source_no AS sourceNo, pw.writeoff_amount AS writeoffAmount, pw.created_at AS createdAt FROM t_payment_writeoff pw LEFT JOIN t_payable p ON p.id = pw.payable_id WHERE pw.payment_id = (SELECT id FROM t_payment WHERE payment_no = ? AND tenant_id = ?)",
    [paymentNo, tenantId], tenantId
  );
  return { ...payment, writeoffs };
}

export async function writeoffPayment(paymentNo: string, payableId: number, writeoffAmount: number, tenantId: string) {
  const payment = await queryOneWithTenant<PaymentIdAmountStatusRow>("SELECT id, amount, status FROM t_payment WHERE payment_no = ? AND tenant_id = ?", [paymentNo, tenantId], tenantId);
  if (!payment) throw new Error("付款单不存在");
  if (payment.status !== "CONFIRMED") throw new Error("只有已确认的付款单可以核销");
  const ap = await queryOneWithTenant<PayableIdBalanceRow>("SELECT id, balance FROM t_payable WHERE id = ? AND tenant_id = ?", [payableId, tenantId], tenantId);
  if (!ap) throw new Error("应付记录不存在");
  if (Number(ap.balance) < writeoffAmount) throw new Error("核销金额不能超过应付余额");
  await queryWithTenant("INSERT INTO t_payment_writeoff (payment_id, payable_id, writeoff_amount, tenant_id) VALUES (?, ?, ?, ?)", [payment.id, payableId, writeoffAmount, tenantId], tenantId);
  const newBalance = Number(ap.balance) - writeoffAmount;
  const newStatus = newBalance <= 0 ? "PAID" : "PARTIAL";
  await queryWithTenant("UPDATE t_payable SET paid_amount = paid_amount + ?, balance = ?, status = ? WHERE id = ? AND tenant_id = ?", [writeoffAmount, newBalance, newStatus, payableId, tenantId], tenantId);
  return { paymentNo, payableId, writeoffAmount, balanceAfter: newBalance };
}

export async function voidPayment(paymentNo: string, tenantId: string) {
  const payment = await queryOneWithTenant<PaymentIdStatusRow>("SELECT id, status FROM t_payment WHERE payment_no = ? AND tenant_id = ?", [paymentNo, tenantId], tenantId);
  if (!payment) throw new Error("付款单不存在");
  if (payment.status === "VOIDED") throw new Error("付款单已作废");
  const writeoffs = await queryWithTenant<PaymentWriteoffSimpleRow>("SELECT payable_id, writeoff_amount FROM t_payment_writeoff WHERE payment_id = ? AND tenant_id = ?", [payment.id, tenantId], tenantId);
  for (const wo of writeoffs) {
    await queryWithTenant("UPDATE t_payable SET paid_amount = paid_amount - ?, balance = balance + ?, status = CASE WHEN balance + ? >= payable_amount THEN 'PAID' WHEN paid_amount > 0 THEN 'PARTIAL' ELSE 'PENDING' END WHERE id = ? AND tenant_id = ?", [wo.writeoff_amount, wo.writeoff_amount, wo.writeoff_amount, wo.payable_id, tenantId], tenantId);
  }
  await queryWithTenant("DELETE FROM t_payment_writeoff WHERE payment_id = ? AND tenant_id = ?", [payment.id, tenantId], tenantId);
  await queryWithTenant("UPDATE t_payment SET status = 'VOIDED' WHERE id = ? AND tenant_id = ?", [payment.id, tenantId], tenantId);
  return { paymentNo, status: "VOIDED" };
}

// 自动生成应付
export async function generatePayable(orderNo: string, supplierId: number, supplierName: string, amount: number, tenantId: string) {
  const existing = await queryOneWithTenant<IdRow>("SELECT id FROM t_payable WHERE source_no = ? AND tenant_id = ?", [orderNo, tenantId], tenantId);
  if (existing) return null;
  await queryWithTenant(
    "INSERT INTO t_payable (supplier_id, supplier_name, source_type, source_no, payable_amount, paid_amount, balance, status, tenant_id) VALUES (?, ?, 'PURCHASE_ORDER', ?, ?, 0, ?, 'PENDING', ?)",
    [supplierId, supplierName ?? null, orderNo, amount, amount, tenantId], tenantId
  );
  return { orderNo, supplierId, amount };
}