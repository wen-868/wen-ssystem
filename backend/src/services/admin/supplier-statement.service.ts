import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

// 生成对账单
export async function generateSupplierStatement(params: {
  supplierId: number; startDate: string; endDate: string; tenantId: string;
}) {
  const { supplierId, startDate, endDate, tenantId } = params;
  // 汇总采购金额
  const purchaseData = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(po.goods_amount), 0) AS purchaseAmount, COUNT(*) AS orderCount
     FROM t_purchase_order po
     WHERE po.supplier_id = ? AND po.tenant_id = ?
       AND po.created_at >= ? AND po.created_at <= ?
       AND po.order_status NOT IN ('VOIDED')`,
    [supplierId, tenantId, startDate, endDate],
    tenantId
  );
  // 汇总已付金额
  const paymentData = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(pp.amount), 0) AS paidAmount
     FROM t_purchase_payment pp
     WHERE pp.supplier_id = ? AND pp.tenant_id = ?
       AND pp.created_at >= ? AND pp.created_at <= ?
       AND pp.status = 'SUCCESS'`,
    [supplierId, tenantId, startDate, endDate],
    tenantId
  );
  // 汇总退货金额
  const returnData = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(pr.return_amount), 0) AS returnAmount, COUNT(*) AS returnCount
     FROM t_purchase_return pr
     WHERE pr.supplier_id = ? AND pr.tenant_id = ?
       AND pr.created_at >= ? AND pr.created_at <= ?
       AND pr.status NOT IN ('VOIDED')`,
    [supplierId, tenantId, startDate, endDate],
    tenantId
  );
  const purchaseAmount = Number(purchaseData?.purchaseAmount ?? 0);
  const paidAmount = Number(paymentData?.paidAmount ?? 0);
  const returnAmount = Number(returnData?.returnAmount ?? 0);
  const balance = purchaseAmount - paidAmount - returnAmount;
  const statementNo = makeBizNo("DZ");
  await queryWithTenant(
    `INSERT INTO t_supplier_statement (statement_no, supplier_id, start_date, end_date,
     purchase_amount, paid_amount, return_amount, balance, statement_status, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'GENERATED', ?)`,
    [statementNo, supplierId, startDate, endDate, purchaseAmount, paidAmount, returnAmount, balance, tenantId],
    tenantId
  );
  // 写入明细
  const orders = await queryWithTenant<any>(
    `SELECT order_no AS orderNo, goods_amount AS goodsAmount, order_status AS orderStatus, created_at AS createdAt
     FROM t_purchase_order WHERE supplier_id = ? AND tenant_id = ?
       AND created_at >= ? AND created_at <= ?
       AND order_status NOT IN ('VOIDED')
     ORDER BY created_at`,
    [supplierId, tenantId, startDate, endDate],
    tenantId
  );
  for (const order of orders) {
    await queryWithTenant(
      `INSERT INTO t_supplier_statement_item (statement_no, item_type, item_no, amount, status, tenant_id)
       VALUES (?, 'PURCHASE', ?, ?, ?, ?)`,
      [statementNo, order.orderNo, order.goodsAmount, order.orderStatus, tenantId],
      tenantId
    );
  }
  const payments = await queryWithTenant<any>(
    `SELECT payment_no AS paymentNo, amount, created_at AS createdAt
     FROM t_purchase_payment WHERE supplier_id = ? AND tenant_id = ?
       AND created_at >= ? AND created_at <= ? AND status = 'SUCCESS'
     ORDER BY created_at`,
    [supplierId, tenantId, startDate, endDate],
    tenantId
  );
  for (const p of payments) {
    await queryWithTenant(
      `INSERT INTO t_supplier_statement_item (statement_no, item_type, item_no, amount, status, tenant_id)
       VALUES (?, 'PAYMENT', ?, ?, 'SUCCESS', ?)`,
      [statementNo, p.paymentNo, p.amount, tenantId],
      tenantId
    );
  }
  const returns = await queryWithTenant<any>(
    `SELECT return_no AS returnNo, return_amount AS returnAmount, status, created_at AS createdAt
     FROM t_purchase_return WHERE supplier_id = ? AND tenant_id = ?
       AND created_at >= ? AND created_at <= ? AND status NOT IN ('VOIDED')
     ORDER BY created_at`,
    [supplierId, tenantId, startDate, endDate],
    tenantId
  );
  for (const r of returns) {
    await queryWithTenant(
      `INSERT INTO t_supplier_statement_item (statement_no, item_type, item_no, amount, status, tenant_id)
       VALUES (?, 'RETURN', ?, ?, ?, ?)`,
      [statementNo, r.returnNo, r.returnAmount, r.status, tenantId],
      tenantId
    );
  }
  return {
    statementNo, supplierId, startDate, endDate,
    purchaseAmount, paidAmount, returnAmount, balance,
    orderCount: purchaseData?.orderCount ?? 0,
    returnCount: returnData?.returnCount ?? 0
  };
}

// 对账单列表
export async function listSupplierStatements(params: {
  supplierId?: number; status?: string; startDate?: string; endDate?: string;
  page: number; pageSize: number; tenantId: string;
}) {
  const { supplierId, status, startDate, endDate, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["ss.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];
  if (supplierId !== undefined) { conditions.push("ss.supplier_id = ?"); queryParams.push(supplierId); }
  if (status) { conditions.push("ss.statement_status = ?"); queryParams.push(status); }
  if (startDate) { conditions.push("ss.created_at >= ?"); queryParams.push(startDate); }
  if (endDate) { conditions.push("ss.created_at <= ?"); queryParams.push(endDate); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<any>(
    `SELECT ss.statement_no AS statementNo, ss.supplier_id AS supplierId,
            s.name AS supplierName, ss.start_date AS startDate, ss.end_date AS endDate,
            ss.purchase_amount AS purchaseAmount, ss.paid_amount AS paidAmount,
            ss.return_amount AS returnAmount, ss.balance,
            ss.statement_status AS statementStatus, ss.created_at AS createdAt
     FROM t_supplier_statement ss
     LEFT JOIN supplier s ON s.id = ss.supplier_id
     ${where}
     ORDER BY ss.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_supplier_statement ss ${where}`,
    queryParams,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

// 对账单详情
export async function getSupplierStatementDetail(statementNo: string, tenantId: string) {
  const statement = await queryOneWithTenant<any>(
    `SELECT ss.statement_no AS statementNo, ss.supplier_id AS supplierId,
            s.name AS supplierName, s.contact_name AS supplierContact,
            ss.start_date AS startDate, ss.end_date AS endDate,
            ss.purchase_amount AS purchaseAmount, ss.paid_amount AS paidAmount,
            ss.return_amount AS returnAmount, ss.balance,
            ss.statement_status AS statementStatus, ss.created_at AS createdAt
     FROM t_supplier_statement ss
     LEFT JOIN supplier s ON s.id = ss.supplier_id
     WHERE ss.statement_no = ? AND ss.tenant_id = ?`,
    [statementNo, tenantId],
    tenantId
  );
  if (!statement) throw new Error("对账单不存在");
  const items = await queryWithTenant<any>(
    `SELECT item_type AS itemType, item_no AS itemNo, amount, status, created_at AS createdAt
     FROM t_supplier_statement_item
     WHERE statement_no = ? AND tenant_id = ?
     ORDER BY created_at`,
    [statementNo, tenantId],
    tenantId
  );
  return { ...statement, items };
}

// 确认对账
export async function confirmSupplierStatement(statementNo: string, tenantId: string) {
  const existing = await queryOneWithTenant<any>(
    "SELECT statement_no, statement_status FROM t_supplier_statement WHERE statement_no = ? AND tenant_id = ?",
    [statementNo, tenantId],
    tenantId
  );
  if (!existing) throw new Error("对账单不存在");
  if (existing.statement_status !== "GENERATED") throw new Error("只有待确认的对账单可以确认");
  await queryWithTenant(
    `UPDATE t_supplier_statement SET statement_status = 'CONFIRMED' WHERE statement_no = ? AND tenant_id = ?`,
    [statementNo, tenantId],
    tenantId
  );
  return { statementNo, status: "CONFIRMED" };
}

// 标记争议
export async function disputeSupplierStatement(statementNo: string, reason: string, tenantId: string) {
  const existing = await queryOneWithTenant<any>(
    "SELECT statement_no, statement_status FROM t_supplier_statement WHERE statement_no = ? AND tenant_id = ?",
    [statementNo, tenantId],
    tenantId
  );
  if (!existing) throw new Error("对账单不存在");
  if (existing.statement_status !== "GENERATED") throw new Error("只有待确认的对账单可以标记争议");
  await queryWithTenant(
    `UPDATE t_supplier_statement SET statement_status = 'DISPUTED', remark = ? WHERE statement_no = ? AND tenant_id = ?`,
    [reason ?? "", statementNo, tenantId],
    tenantId
  );
  return { statementNo, status: "DISPUTED" };
}