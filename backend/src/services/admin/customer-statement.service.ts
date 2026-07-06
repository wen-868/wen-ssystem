import { query, queryOne, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

export async function list(params: {
  page: number; pageSize: number; tenantId: string;
  customerId?: number; status?: string; dateStart?: string; dateEnd?: string;
}) {
  const { page, pageSize, tenantId, customerId, status, dateStart, dateEnd } = params;
  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (customerId !== undefined) {
    conditions.push("customer_id = ?");
    queryParams.push(customerId);
  }
  if (status) {
    conditions.push("status = ?");
    queryParams.push(status);
  }
  if (dateStart) {
    conditions.push("start_date >= ?");
    queryParams.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("end_date <= ?");
    queryParams.push(dateEnd);
  }

  const whereClause = " AND tenant_id = ?" + (conditions.length > 0 ? " AND " + conditions.join(" AND ") : "");
  const offset = (page - 1) * pageSize;
  const statements = await query<any>(
    `SELECT * FROM t_customer_statement WHERE 1=1${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [tenantId, ...queryParams, pageSize, offset]
  );
  return statements;
}

export async function getDetail(statementNo: string, tenantId: string) {
  const statement = await queryOne<any>(
    "SELECT * FROM t_customer_statement WHERE statement_no = ? AND tenant_id = ?",
    [statementNo, tenantId]
  );
  if (!statement) throw Object.assign(new Error("对账单不存在"), { statusCode: 404 });

  const sales = await query<any>(
    `SELECT bill_no AS sale_bill_no, customer_name, receivable_amount, created_at
     FROM t_sale_bill WHERE customer_id = ? AND created_at BETWEEN ? AND ? AND business_status = 'CREATED'
     ORDER BY created_at ASC`,
    [statement.customer_id, statement.start_date, statement.end_date]
  );
  const returns = await query<any>(
    `SELECT return_no AS sale_return_no, refund_amount, created_at
     FROM t_sale_return WHERE customer_id = ? AND created_at BETWEEN ? AND ? AND return_status = 'COMPLETED'
     ORDER BY created_at ASC`,
    [statement.customer_id, statement.start_date, statement.end_date]
  );
  const payments = await query<any>(
    `SELECT receipt_no, amount, payment_date
     FROM t_customer_payment WHERE customer_id = ? AND payment_date BETWEEN ? AND ? AND status = 'COMPLETED'
     ORDER BY payment_date ASC`,
    [statement.customer_id, statement.start_date, statement.end_date]
  );

  return { ...statement, sales, returns, payments };
}

export async function create(body: {
  customer_id: number; customer_name: string; customer_mobile?: string;
  statement_type?: string; start_date: string; end_date: string; remark?: string;
}, tenantId: string, userId: number, username: string) {
  const statementNo = makeBizNo("DZ");

  await transaction(async (conn) => {
    const [openingRows] = await conn.query(
      `SELECT COALESCE(SUM(unreceived_amount), 0) AS opening_balance
       FROM t_sale_bill WHERE customer_id = ? AND created_at < ? AND collection_status IN ('UNPAID', 'PARTIAL') AND business_status = 'CREATED'`,
      [body.customer_id, body.start_date]
    );
    const openingBalance = Number((openingRows as Record<string, unknown>[])?.[0]?.opening_balance || 0);

    const [salesRows] = await conn.query(
      `SELECT COALESCE(SUM(receivable_amount), 0) AS total_sales
       FROM t_sale_bill WHERE customer_id = ? AND created_at BETWEEN ? AND ? AND business_status = 'CREATED'`,
      [body.customer_id, body.start_date, body.end_date]
    );
    const totalSales = Number((salesRows as Record<string, unknown>[])?.[0]?.total_sales || 0);

    const [returnsRows] = await conn.query(
      `SELECT COALESCE(SUM(refund_amount), 0) AS total_returns
       FROM t_sale_return WHERE customer_id = ? AND created_at BETWEEN ? AND ? AND return_status = 'COMPLETED'`,
      [body.customer_id, body.start_date, body.end_date]
    );
    const totalReturns = Number((returnsRows as Record<string, unknown>[])?.[0]?.total_returns || 0);

    const [paymentsRows] = await conn.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_payments
       FROM t_customer_payment WHERE customer_id = ? AND payment_date BETWEEN ? AND ? AND status = 'COMPLETED'`,
      [body.customer_id, body.start_date, body.end_date]
    );
    const totalPayments = Number((paymentsRows as Record<string, unknown>[])?.[0]?.total_payments || 0);

    const closingBalance = openingBalance + totalSales - totalReturns - totalPayments;

    await conn.query(
      `INSERT INTO t_customer_statement (statement_no, customer_id, customer_name, customer_mobile, statement_type,
        start_date, end_date, opening_balance, total_sales, total_returns, total_payments,
        closing_balance, status, operator_id, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)`,
      [statementNo, body.customer_id, body.customer_name, body.customer_mobile || null,
        body.statement_type || "MONTHLY", body.start_date, body.end_date,
        openingBalance, totalSales, totalReturns, totalPayments, closingBalance,
        userId, body.remark || null, tenantId]
    );

    await conn.query(
      "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["customer_statement", "CREATE", statementNo, "customer_statement", userId, username, `创建对账单: ${statementNo}`, tenantId]
    );
  });

  return { statement_no: statementNo };
}

export async function confirm(statementNo: string, tenantId: string, userId: number, username: string) {
  const statement = await queryOne<any>(
    "SELECT id, status FROM t_customer_statement WHERE statement_no = ? AND tenant_id = ?",
    [statementNo, tenantId]
  );
  if (!statement) throw Object.assign(new Error("对账单不存在"), { statusCode: 404 });
  if (statement.status !== "DRAFT") throw Object.assign(new Error("只有草稿状态的对账单可以确认"), { statusCode: 400 });

  await query("UPDATE t_customer_statement SET status = 'CONFIRMED', confirmed_at = NOW() WHERE statement_no = ? AND tenant_id = ?", [statementNo, tenantId]);
  await queryWithTenant(
    "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["customer_statement", "CONFIRM", statementNo, "customer_statement", userId, username, `确认对账单: ${statementNo}`, tenantId],
    tenantId
  );
  return { statement_no: statementNo };
}

export async function markPaid(statementNo: string, tenantId: string, userId: number, username: string) {
  const statement = await queryOne<any>(
    "SELECT id, status FROM t_customer_statement WHERE statement_no = ? AND tenant_id = ?",
    [statementNo, tenantId]
  );
  if (!statement) throw Object.assign(new Error("对账单不存在"), { statusCode: 404 });
  if (statement.status !== "CONFIRMED") throw Object.assign(new Error("只有已确认状态的对账单可以标记结清"), { statusCode: 400 });

  await query("UPDATE t_customer_statement SET status = 'PAID' WHERE statement_no = ? AND tenant_id = ?", [statementNo, tenantId]);
  await queryWithTenant(
    "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["customer_statement", "PAID", statementNo, "customer_statement", userId, username, `标记结清: ${statementNo}`, tenantId],
    tenantId
  );
  return { statement_no: statementNo };
}