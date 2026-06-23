import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const customerStatementRouter = Router();

// 列表查询
customerStatementRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { customer_id, status, start_date, end_date, page = 1, pageSize = 20 } = req.query;
  const tenantId = req.tenantId;

  let sql = "SELECT * FROM customer_statement WHERE tenant_id = ?";
  const params: any[] = [tenantId];

  if (customer_id) {
    sql += " AND customer_id = ?";
    params.push(Number(customer_id));
  }

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  if (start_date) {
    sql += " AND start_date >= ?";
    params.push(start_date);
  }

  if (end_date) {
    sql += " AND end_date <= ?";
    params.push(end_date);
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const statements = await query<any>(sql, params);
  res.json(ok(statements));
}));

// 详情查询
customerStatementRouter.get("/:statementNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { statementNo } = req.params;
  const tenantId = req.tenantId;

  const statement = await queryOne<any>(
    "SELECT * FROM customer_statement WHERE statement_no = ? AND tenant_id = ?",
    [statementNo, tenantId]
  );

  if (!statement) {
    res.status(404).json({ code: "404", message: "对账单不存在" });
    return;
  }

  // 查询关联的销售单
  const sales = await query<any>(
    `SELECT bill_no AS sale_bill_no, customer_name, receivable_amount, created_at
     FROM sale_bill
     WHERE customer_id = ?
       AND created_at BETWEEN ? AND ?
       AND business_status = 'CREATED'
     ORDER BY created_at ASC`,
    [statement.customer_id, statement.start_date, statement.end_date]
  );

  // 查询关联的退货单
  const returns = await query<any>(
    `SELECT return_no AS sale_return_no, refund_amount, created_at
     FROM sale_return
     WHERE customer_id = ?
       AND created_at BETWEEN ? AND ?
       AND return_status = 'COMPLETED'
     ORDER BY created_at ASC`,
    [statement.customer_id, statement.start_date, statement.end_date]
  );

  // 查询关联的收款单
  const payments = await query<any>(
    `SELECT receipt_no, amount, payment_date
     FROM customer_payment
     WHERE customer_id = ?
       AND payment_date BETWEEN ? AND ?
       AND status = 'COMPLETED'
     ORDER BY payment_date ASC`,
    [statement.customer_id, statement.start_date, statement.end_date]
  );

  res.json(ok({ ...statement, sales, returns, payments }));
}));

// 创建对账单
customerStatementRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    customer_id: z.number().int().positive(),
    customer_name: z.string().min(1).max(64),
    customer_mobile: z.string().max(20).optional(),
    statement_type: z.enum(["MONTHLY", "QUARTERLY", "CUSTOM"]).default("MONTHLY"),
    start_date: z.string(),
    end_date: z.string(),
    remark: z.string().max(255).optional(),
  }).parse(req.body);

  const tenantId = req.tenantId;
  const statementNo = makeBizNo("DZ");

  await transaction(async (conn) => {
    // 查询期初余额（对账开始日期之前的未结清金额）
    const openingResult = await conn.execute(
      `SELECT COALESCE(SUM(unreceived_amount), 0) AS opening_balance
       FROM sale_bill
       WHERE customer_id = ?
         AND created_at < ?
         AND collection_status IN ('UNPAID', 'PARTIAL')
         AND business_status = 'CREATED'`,
      [body.customer_id, body.start_date]
    );

    const openingRow = (openingResult[0] as any[])?.[0];
    const openingBalance = Number(openingRow?.opening_balance || 0);

    // 查询本期销售
    const salesResult = await conn.execute(
      `SELECT COALESCE(SUM(receivable_amount), 0) AS total_sales
       FROM sale_bill
       WHERE customer_id = ?
         AND created_at BETWEEN ? AND ?
         AND business_status = 'CREATED'`,
      [body.customer_id, body.start_date, body.end_date]
    );

    const salesRow = (salesResult[0] as any[])?.[0];
    const totalSales = Number(salesRow?.total_sales || 0);

    // 查询本期退货
    const returnsResult = await conn.execute(
      `SELECT COALESCE(SUM(refund_amount), 0) AS total_returns
       FROM sale_return
       WHERE customer_id = ?
         AND created_at BETWEEN ? AND ?
         AND return_status = 'COMPLETED'`,
      [body.customer_id, body.start_date, body.end_date]
    );

    const returnsRow = (returnsResult[0] as any[])?.[0];
    const totalReturns = Number(returnsRow?.total_returns || 0);

    // 查询本期收款
    const paymentsResult = await conn.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total_payments
       FROM customer_payment
       WHERE customer_id = ?
         AND payment_date BETWEEN ? AND ?
         AND status = 'COMPLETED'`,
      [body.customer_id, body.start_date, body.end_date]
    );

    const paymentsRow = (paymentsResult[0] as any[])?.[0];
    const totalPayments = Number(paymentsRow?.total_payments || 0);

    // 计算期末余额
    const closingBalance = openingBalance + totalSales - totalReturns - totalPayments;

    // 插入对账单
    await conn.execute(
      `INSERT INTO customer_statement (
        statement_no, customer_id, customer_name, customer_mobile, statement_type,
        start_date, end_date, opening_balance, total_sales, total_returns, total_payments,
        closing_balance, status, operator_id, remark, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)`,
      [
        statementNo, body.customer_id, body.customer_name, body.customer_mobile || null,
        body.statement_type, body.start_date, body.end_date,
        openingBalance, totalSales, totalReturns, totalPayments, closingBalance,
        req.user?.id, body.remark || null, tenantId
      ]
    );

    // 写操作日志
    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["customer_statement", "CREATE", statementNo, "customer_statement", req.user?.id, req.user?.username, `创建对账单: ${statementNo}`, tenantId]
    );
  });

  res.json(ok({ statement_no: statementNo }));
}));

// 确认对账单（DRAFT -> CONFIRMED）
customerStatementRouter.post("/:statementNo/confirm", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { statementNo } = req.params;
  const tenantId = req.tenantId;

  const statement = await queryOne<any>(
    "SELECT id, status FROM customer_statement WHERE statement_no = ? AND tenant_id = ?",
    [statementNo, tenantId]
  );

  if (!statement) {
    res.status(404).json({ code: "404", message: "对账单不存在" });
    return;
  }

  if (statement.status !== "DRAFT") {
    res.status(400).json({ code: "400", message: "只有草稿状态的对账单可以确认" });
    return;
  }

  await query(
    "UPDATE customer_statement SET status = 'CONFIRMED', confirmed_at = NOW() WHERE statement_no = ?",
    [statementNo]
  );

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["customer_statement", "CONFIRM", statementNo, "customer_statement", req.user?.id, req.user?.username, `确认对账单: ${statementNo}`, tenantId]
  );

  res.json(ok({ statement_no: statementNo }));
}));

// 标记结清（CONFIRMED -> PAID）
customerStatementRouter.post("/:statementNo/paid", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { statementNo } = req.params;
  const tenantId = req.tenantId;

  const statement = await queryOne<any>(
    "SELECT id, status FROM customer_statement WHERE statement_no = ? AND tenant_id = ?",
    [statementNo, tenantId]
  );

  if (!statement) {
    res.status(404).json({ code: "404", message: "对账单不存在" });
    return;
  }

  if (statement.status !== "CONFIRMED") {
    res.status(400).json({ code: "400", message: "只有已确认状态的对账单可以标记结清" });
    return;
  }

  await query(
    "UPDATE customer_statement SET status = 'PAID' WHERE statement_no = ?",
    [statementNo]
  );

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["customer_statement", "PAID", statementNo, "customer_statement", req.user?.id, req.user?.username, `标记结清: ${statementNo}`, tenantId]
  );

  res.json(ok({ statement_no: statementNo }));
}));
