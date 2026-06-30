import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

export async function listReceivables(params: { customerId?: number; status?: string; page: number; pageSize: number; tenantId: string }) {
  const { customerId, status, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions = ["tenant_id = ?"]; const values: unknown[] = [tenantId];
  if (customerId !== undefined) { conditions.push("customer_id = ?"); values.push(customerId); }
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<any>(
    `SELECT id, customer_id AS customerId, customer_name AS customerName, source_type AS sourceType, source_no AS sourceNo, receivable_amount AS receivableAmount, received_amount AS receivedAmount, balance, due_date AS dueDate, status, created_at AS createdAt
     FROM receivable ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS total FROM receivable ${where}`, values, tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}

export async function listPayables(params: { supplierId?: number; status?: string; page: number; pageSize: number; tenantId: string }) {
  const { supplierId, status, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions = ["tenant_id = ?"]; const values: unknown[] = [tenantId];
  if (supplierId !== undefined) { conditions.push("supplier_id = ?"); values.push(supplierId); }
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<any>(
    `SELECT id, supplier_id AS supplierId, supplier_name AS supplierName, source_type AS sourceType, source_no AS sourceNo, payable_amount AS payableAmount, paid_amount AS paidAmount, balance, due_date AS dueDate, status, created_at AS createdAt
     FROM payable ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS total FROM payable ${where}`, values, tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}

export async function getReceivablesAging(tenantId: string) {
  const now = new Date();
  const aging = await queryWithTenant<any>(
    `SELECT CASE WHEN DATEDIFF(NOW(), due_date) <= 30 THEN '0-30天'
                 WHEN DATEDIFF(NOW(), due_date) <= 60 THEN '30-60天'
                 WHEN DATEDIFF(NOW(), due_date) <= 90 THEN '60-90天'
                 ELSE '90天以上' END AS agingGroup,
            COALESCE(SUM(balance), 0) AS totalAmount, COUNT(*) AS cnt
     FROM receivable WHERE tenant_id = ? AND status IN ('PENDING', 'PARTIAL') AND due_date IS NOT NULL
     GROUP BY agingGroup ORDER BY agingGroup`,
    [tenantId], tenantId
  );
  return aging;
}

export async function getPayablesAging(tenantId: string) {
  const aging = await queryWithTenant<any>(
    `SELECT CASE WHEN DATEDIFF(NOW(), due_date) <= 30 THEN '0-30天'
                 WHEN DATEDIFF(NOW(), due_date) <= 60 THEN '30-60天'
                 WHEN DATEDIFF(NOW(), due_date) <= 90 THEN '60-90天'
                 ELSE '90天以上' END AS agingGroup,
            COALESCE(SUM(balance), 0) AS totalAmount, COUNT(*) AS cnt
     FROM payable WHERE tenant_id = ? AND status IN ('PENDING', 'PARTIAL') AND due_date IS NOT NULL
     GROUP BY agingGroup ORDER BY agingGroup`,
    [tenantId], tenantId
  );
  return aging;
}

export async function getReceivableDetail(id: number, tenantId: string) {
  const ar = await queryOneWithTenant<any>("SELECT * FROM receivable WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (!ar) throw new Error("记录不存在");
  const writeoffs = await queryWithTenant<any>(
    "SELECT rw.writeoff_amount AS writeoffAmount, r.receipt_no AS receiptNo, rw.created_at AS createdAt FROM receipt_writeoff rw LEFT JOIN receipt r ON r.id = rw.receipt_id WHERE rw.receivable_id = ? AND rw.tenant_id = ?",
    [id, tenantId], tenantId
  );
  return { ...ar, writeoffs };
}

export async function getPayableDetail(id: number, tenantId: string) {
  const ap = await queryOneWithTenant<any>("SELECT * FROM payable WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (!ap) throw new Error("记录不存在");
  const writeoffs = await queryWithTenant<any>(
    "SELECT pw.writeoff_amount AS writeoffAmount, p.payment_no AS paymentNo, pw.created_at AS createdAt FROM payment_writeoff pw LEFT JOIN payment p ON p.id = pw.payment_id WHERE pw.payable_id = ? AND pw.tenant_id = ?",
    [id, tenantId], tenantId
  );
  return { ...ap, writeoffs };
}