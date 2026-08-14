import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

/** 应收列表行 */
interface ReceivableListRow {
  id: number | string;
  customerId: number | string;
  customerName: string;
  sourceType: string | null;
  sourceNo: string | null;
  receivableAmount: number | string;
  receivedAmount: number | string;
  balance: number | string;
  dueDate: string | Date | null;
  status: string;
  createdAt: string | Date;
}

/** 应付列表行 */
interface PayableListRow {
  id: number | string;
  supplierId: number | string;
  supplierName: string;
  sourceType: string | null;
  sourceNo: string | null;
  payableAmount: number | string;
  paidAmount: number | string;
  balance: number | string;
  dueDate: string | Date | null;
  status: string;
  createdAt: string | Date;
}

/** 账龄统计行 */
interface AgingRow {
  agingGroup: string;
  totalAmount: number | string;
  cnt: number;
}

/** 应收完整行（SELECT *，下划线字段名） */
interface ReceivableRow {
  id: number | string;
  customer_id: number | string;
  customer_name: string;
  source_type: string | null;
  source_no: string | null;
  receivable_amount: number | string;
  received_amount: number | string;
  balance: number | string;
  due_date: string | Date | null;
  status: string;
  tenant_id: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/** 应付完整行（SELECT *，下划线字段名） */
interface PayableRow {
  id: number | string;
  supplier_id: number | string;
  supplier_name: string;
  source_type: string | null;
  source_no: string | null;
  payable_amount: number | string;
  paid_amount: number | string;
  balance: number | string;
  due_date: string | Date | null;
  status: string;
  tenant_id: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/** 应收核销记录行（关联收款单） */
interface ReceivableWriteoffRow {
  writeoffAmount: number | string;
  receiptNo: string | null;
  createdAt: string | Date;
}

/** 应付核销记录行（关联付款单） */
interface PayableWriteoffRow {
  writeoffAmount: number | string;
  paymentNo: string | null;
  createdAt: string | Date;
}

/** COUNT(*) AS total 结果行 */
interface CountTotalRow {
  total: number;
}

export async function listReceivables(params: { customerId?: number; status?: string; page: number; pageSize: number; tenantId: string }) {
  const { customerId, status, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions = ["tenant_id = ?"]; const values: unknown[] = [tenantId];
  if (customerId !== undefined) { conditions.push("customer_id = ?"); values.push(customerId); }
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<ReceivableListRow>(
    `SELECT id, customer_id AS customerId, customer_name AS customerName, source_type AS sourceType, source_no AS sourceNo, receivable_amount AS receivableAmount, received_amount AS receivedAmount, balance, due_date AS dueDate, status, created_at AS createdAt
     FROM t_receivable ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<CountTotalRow>(`SELECT COUNT(*) AS total FROM t_receivable ${where}`, values, tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}

export async function listPayables(params: { supplierId?: number; status?: string; page: number; pageSize: number; tenantId: string }) {
  const { supplierId, status, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions = ["tenant_id = ?"]; const values: unknown[] = [tenantId];
  if (supplierId !== undefined) { conditions.push("supplier_id = ?"); values.push(supplierId); }
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<PayableListRow>(
    `SELECT id, supplier_id AS supplierId, supplier_name AS supplierName, source_type AS sourceType, source_no AS sourceNo, payable_amount AS payableAmount, paid_amount AS paidAmount, balance, due_date AS dueDate, status, created_at AS createdAt
     FROM t_payable ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<CountTotalRow>(`SELECT COUNT(*) AS total FROM t_payable ${where}`, values, tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}

export async function getReceivablesAging(tenantId: string) {
  const now = new Date();
  const aging = await queryWithTenant<AgingRow>(
    `SELECT CASE WHEN DATEDIFF(NOW(), due_date) <= 30 THEN '0-30天'
                 WHEN DATEDIFF(NOW(), due_date) <= 60 THEN '30-60天'
                 WHEN DATEDIFF(NOW(), due_date) <= 90 THEN '60-90天'
                 ELSE '90天以上' END AS agingGroup,
            COALESCE(SUM(balance), 0) AS totalAmount, COUNT(*) AS cnt
     FROM t_receivable WHERE tenant_id = ? AND status IN ('PENDING', 'PARTIAL') AND due_date IS NOT NULL
     GROUP BY agingGroup ORDER BY agingGroup`,
    [tenantId], tenantId
  );
  return aging;
}

export async function getPayablesAging(tenantId: string) {
  const aging = await queryWithTenant<AgingRow>(
    `SELECT CASE WHEN DATEDIFF(NOW(), due_date) <= 30 THEN '0-30天'
                 WHEN DATEDIFF(NOW(), due_date) <= 60 THEN '30-60天'
                 WHEN DATEDIFF(NOW(), due_date) <= 90 THEN '60-90天'
                 ELSE '90天以上' END AS agingGroup,
            COALESCE(SUM(balance), 0) AS totalAmount, COUNT(*) AS cnt
     FROM t_payable WHERE tenant_id = ? AND status IN ('PENDING', 'PARTIAL') AND due_date IS NOT NULL
     GROUP BY agingGroup ORDER BY agingGroup`,
    [tenantId], tenantId
  );
  return aging;
}

export async function getReceivableDetail(id: number, tenantId: string) {
  const ar = await queryOneWithTenant<ReceivableRow>("SELECT * FROM t_receivable WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (!ar) throw new Error("记录不存在");
  const writeoffs = await queryWithTenant<ReceivableWriteoffRow>(
    "SELECT rw.writeoff_amount AS writeoffAmount, r.receipt_no AS receiptNo, rw.created_at AS createdAt FROM t_receipt_writeoff rw LEFT JOIN t_receipt r ON r.id = rw.receipt_id WHERE rw.receivable_id = ? AND rw.tenant_id = ?",
    [id, tenantId], tenantId
  );
  return { ...ar, writeoffs };
}

export async function getPayableDetail(id: number, tenantId: string) {
  const ap = await queryOneWithTenant<PayableRow>("SELECT * FROM t_payable WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (!ap) throw new Error("记录不存在");
  const writeoffs = await queryWithTenant<PayableWriteoffRow>(
    "SELECT pw.writeoff_amount AS writeoffAmount, p.payment_no AS paymentNo, pw.created_at AS createdAt FROM t_payment_writeoff pw LEFT JOIN t_payment p ON p.id = pw.payment_id WHERE pw.payable_id = ? AND pw.tenant_id = ?",
    [id, tenantId], tenantId
  );
  return { ...ap, writeoffs };
}