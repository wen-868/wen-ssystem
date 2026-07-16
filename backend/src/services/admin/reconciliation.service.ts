import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

// 客户对账列表
export async function getCustomerReconciliation(tenantId: string, startDate?: string, endDate?: string) {
  let conditions = "1=1";
  const values: unknown[] = [];
  if (startDate) { conditions += " AND r.created_at >= ?"; values.push(startDate); }
  if (endDate) { conditions += " AND r.created_at <= ?"; values.push(endDate); }
  return queryWithTenant<any>(
    `SELECT r.customer_id AS customerId, m.name AS customerName,
            COALESCE(SUM(r.receivable_amount), 0) AS totalReceivable,
            COALESCE(SUM(r.received_amount), 0) AS totalReceived,
            COALESCE(SUM(r.balance), 0) AS balance
     FROM receivable r
     LEFT JOIN t_member m ON m.id = r.customer_id
     WHERE r.tenant_id = ? AND ${conditions}
     GROUP BY r.customer_id, m.name
     ORDER BY balance DESC`,
    [tenantId, ...values], tenantId
  );
}

// 客户对账详情
export async function getCustomerReconciliationDetail(customerId: number, tenantId: string, startDate?: string, endDate?: string) {
  let conditions = "r.tenant_id = ? AND r.customer_id = ?";
  const values: unknown[] = [tenantId, customerId];
  if (startDate) { conditions += " AND r.created_at >= ?"; values.push(startDate); }
  if (endDate) { conditions += " AND r.created_at <= ?"; values.push(endDate); }
  const customer = await queryOneWithTenant<any>("SELECT id, name FROM t_member WHERE id = ? AND tenant_id = ?", [customerId, tenantId], tenantId);
  const summary = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS totalReceivable, COALESCE(SUM(received_amount), 0) AS totalReceived, COALESCE(SUM(balance), 0) AS balance
     FROM receivable WHERE ${conditions}`,
    values, tenantId
  );
  const details = await queryWithTenant<any>(
    `SELECT source_type AS sourceType, source_no AS sourceNo, receivable_amount AS receivableAmount, received_amount AS receivedAmount, balance, due_date AS dueDate, status, created_at AS createdAt
     FROM receivable WHERE ${conditions} ORDER BY created_at`,
    values, tenantId
  );
  return { customerId, customerName: customer?.name ?? "", ...summary, details };
}

// 确认客户对账
export async function confirmCustomerReconciliation(customerId: number, tenantId: string) {
  await queryWithTenant("UPDATE receivable SET status = 'CONFIRMED' WHERE customer_id = ? AND tenant_id = ? AND status = 'PENDING'", [customerId, tenantId], tenantId);
  return { customerId, status: "CONFIRMED" };
}

// 供应商对账列表
export async function getSupplierReconciliation(tenantId: string, startDate?: string, endDate?: string) {
  let conditions = "1=1";
  const values: unknown[] = [];
  if (startDate) { conditions += " AND p.created_at >= ?"; values.push(startDate); }
  if (endDate) { conditions += " AND p.created_at <= ?"; values.push(endDate); }
  return queryWithTenant<any>(
    `SELECT p.supplier_id AS supplierId, s.name AS supplierName,
            COALESCE(SUM(p.payable_amount), 0) AS totalPayable,
            COALESCE(SUM(p.paid_amount), 0) AS totalPaid,
            COALESCE(SUM(p.balance), 0) AS balance
     FROM payable p
     LEFT JOIN t_supplier s ON s.id = p.supplier_id
     WHERE p.tenant_id = ? AND ${conditions}
     GROUP BY p.supplier_id, s.name
     ORDER BY balance DESC`,
    [tenantId, ...values], tenantId
  );
}

export async function getSupplierReconciliationDetail(supplierId: number, tenantId: string, startDate?: string, endDate?: string) {
  let conditions = "tenant_id = ? AND supplier_id = ?";
  const values: unknown[] = [tenantId, supplierId];
  if (startDate) { conditions += " AND created_at >= ?"; values.push(startDate); }
  if (endDate) { conditions += " AND created_at <= ?"; values.push(endDate); }
  const supplier = await queryOneWithTenant<any>("SELECT id, name FROM t_supplier WHERE id = ? AND tenant_id = ?", [supplierId, tenantId], tenantId);
  const summary = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(payable_amount), 0) AS totalPayable, COALESCE(SUM(paid_amount), 0) AS totalPaid, COALESCE(SUM(balance), 0) AS balance
     FROM payable WHERE ${conditions}`,
    values, tenantId
  );
  const details = await queryWithTenant<any>(
    `SELECT source_type AS sourceType, source_no AS sourceNo, payable_amount AS payableAmount, paid_amount AS paidAmount, balance, due_date AS dueDate, status, created_at AS createdAt
     FROM payable WHERE ${conditions} ORDER BY created_at`,
    values, tenantId
  );
  return { supplierId, supplierName: supplier?.name ?? "", ...summary, details };
}

export async function confirmSupplierReconciliation(supplierId: number, tenantId: string) {
  await queryWithTenant("UPDATE payable SET status = 'CONFIRMED' WHERE supplier_id = ? AND tenant_id = ? AND status = 'PENDING'", [supplierId, tenantId], tenantId);
  return { supplierId, status: "CONFIRMED" };
}