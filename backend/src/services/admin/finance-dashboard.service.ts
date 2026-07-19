import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

export async function getFinanceDashboard(tenantId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = now.toISOString().slice(0, 10);
  const monthIncome = await queryOneWithTenant<any>(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM t_receipt WHERE tenant_id = ? AND status = 'CONFIRMED' AND received_date >= ? AND received_date <= ?",
    [tenantId, monthStart, monthEnd], tenantId
  );
  const monthExpense = await queryOneWithTenant<any>(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM expense WHERE tenant_id = ? AND status = 'APPROVED' AND expense_date >= ? AND expense_date <= ?",
    [tenantId, monthStart, monthEnd], tenantId
  );
  const totalAR = await queryOneWithTenant<any>(
    "SELECT COALESCE(SUM(balance), 0) AS total FROM t_receivable WHERE tenant_id = ? AND status IN ('PENDING', 'PARTIAL')",
    [tenantId], tenantId
  );
  const totalAP = await queryOneWithTenant<any>(
    "SELECT COALESCE(SUM(balance), 0) AS total FROM payable WHERE tenant_id = ? AND status IN ('PENDING', 'PARTIAL')",
    [tenantId], tenantId
  );
  const monthPayment = await queryOneWithTenant<any>(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM payment WHERE tenant_id = ? AND status = 'CONFIRMED' AND paid_date >= ? AND paid_date <= ?",
    [tenantId, monthStart, monthEnd], tenantId
  );
  return {
    monthIncome: monthIncome?.total ?? 0,
    monthExpense: monthExpense?.total ?? 0,
    monthPayment: monthPayment?.total ?? 0,
    monthProfit: (monthIncome?.total ?? 0) - (monthExpense?.total ?? 0),
    totalAR: totalAR?.total ?? 0,
    totalAP: totalAP?.total ?? 0
  };
}

export async function getDailyReport(tenantId: string, startDate?: string, endDate?: string) {
  const conditions = ["tenant_id = ?"]; const values: unknown[] = [tenantId];
  if (startDate) { conditions.push("received_date >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("received_date <= ?"); values.push(endDate); }
  const where = conditions.join(" AND ");
  return queryWithTenant<any>(
    `SELECT received_date AS date, COALESCE(SUM(amount), 0) AS income
     FROM t_receipt WHERE ${where} AND status = 'CONFIRMED'
     GROUP BY received_date ORDER BY received_date`,
    values, tenantId
  );
}

export async function getMonthlyReport(tenantId: string, year?: number) {
  const yr = year ?? new Date().getFullYear();
  return queryWithTenant<any>(
    `SELECT DATE_FORMAT(received_date, '%Y-%m') AS month, COALESCE(SUM(amount), 0) AS income
     FROM t_receipt WHERE tenant_id = ? AND status = 'CONFIRMED' AND YEAR(received_date) = ?
     GROUP BY DATE_FORMAT(received_date, '%Y-%m') ORDER BY month`,
    [tenantId, yr], tenantId
  );
}

export async function getCashFlow(tenantId: string, months: number = 12) {
  const results: any[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const monthStr = d.toISOString().slice(0, 7);
    const income = await queryOneWithTenant<any>(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM t_receipt WHERE tenant_id = ? AND status = 'CONFIRMED' AND DATE_FORMAT(received_date, '%Y-%m') = ?",
      [tenantId, monthStr], tenantId
    );
    const expense = await queryOneWithTenant<any>(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM expense WHERE tenant_id = ? AND status = 'APPROVED' AND DATE_FORMAT(expense_date, '%Y-%m') = ?",
      [tenantId, monthStr], tenantId
    );
    const payment = await queryOneWithTenant<any>(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM payment WHERE tenant_id = ? AND status = 'CONFIRMED' AND DATE_FORMAT(paid_date, '%Y-%m') = ?",
      [tenantId, monthStr], tenantId
    );
    results.push({
      month: monthStr,
      income: income?.total ?? 0,
      expense: expense?.total ?? 0,
      payment: payment?.total ?? 0,
      netCashFlow: (income?.total ?? 0) - (expense?.total ?? 0) - (payment?.total ?? 0)
    });
  }
  return results;
}

export async function getProfitTrend(tenantId: string, months: number = 12) {
  const results: any[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const monthStr = d.toISOString().slice(0, 7);
    const income = await queryOneWithTenant<any>(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM t_receipt WHERE tenant_id = ? AND status = 'CONFIRMED' AND DATE_FORMAT(received_date, '%Y-%m') = ?",
      [tenantId, monthStr], tenantId
    );
    const expense = await queryOneWithTenant<any>(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM expense WHERE tenant_id = ? AND status = 'APPROVED' AND DATE_FORMAT(expense_date, '%Y-%m') = ?",
      [tenantId, monthStr], tenantId
    );
    results.push({ month: monthStr, income: income?.total ?? 0, expense: expense?.total ?? 0, profit: (income?.total ?? 0) - (expense?.total ?? 0) });
  }
  return results;
}

export async function getTopCustomersAR(tenantId: string, limit: number = 10) {
  return queryWithTenant<any>(
    `SELECT customer_id AS customerId, customer_name AS customerName, COALESCE(SUM(balance), 0) AS totalAR
     FROM t_receivable WHERE tenant_id = ? AND status IN ('PENDING', 'PARTIAL')
     GROUP BY customer_id, customer_name ORDER BY totalAR DESC LIMIT ?`,
    [tenantId, limit], tenantId
  );
}

export async function getTopSuppliersAP(tenantId: string, limit: number = 10) {
  return queryWithTenant<any>(
    `SELECT supplier_id AS supplierId, supplier_name AS supplierName, COALESCE(SUM(balance), 0) AS totalAP
     FROM payable WHERE tenant_id = ? AND status IN ('PENDING', 'PARTIAL')
     GROUP BY supplier_id, supplier_name ORDER BY totalAP DESC LIMIT ?`,
    [tenantId, limit], tenantId
  );
}

// ========== 资金流水 ==========
export async function getCashFlowDetail(params: { tenantId: string; startDate?: string; endDate?: string; type?: string; page: number; pageSize: number }) {
  const { tenantId, startDate, endDate, type, page, pageSize } = params;
  const offset = (page - 1) * pageSize;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];

  if (startDate) { conditions.push("transaction_date >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("transaction_date <= ?"); values.push(endDate); }
  if (type) { conditions.push("transaction_type = ?"); values.push(type); }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const records = await queryWithTenant<any>(
    `SELECT id, transaction_type AS transactionType, transaction_date AS transactionDate, 
            amount, balance_before AS balanceBefore, balance_after AS balanceAfter,
            related_type AS relatedType, related_no AS relatedNo, remark, created_at AS createdAt
     FROM t_cash_flow ${where}
     ORDER BY transaction_date DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset], tenantId
  );

  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS total FROM t_cash_flow ${where}`, values, tenantId);

  return { total: total?.total ?? 0, page, pageSize, records };
}

export async function getIncomeExpenseStats(tenantId: string, startDate?: string, endDate?: string) {
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (startDate) { conditions.push("received_date >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("received_date <= ?"); values.push(endDate); }
  const where = conditions.join(" AND ");

  const income = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM t_receipt WHERE ${where} AND status = 'CONFIRMED'`,
    values, tenantId
  );

  const expenseCond = ["tenant_id = ?"];
  const expenseValues: unknown[] = [tenantId];
  if (startDate) { expenseCond.push("expense_date >= ?"); expenseValues.push(startDate); }
  if (endDate) { expenseCond.push("expense_date <= ?"); expenseValues.push(endDate); }
  const expenseWhere = expenseCond.join(" AND ");

  const expense = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM expense WHERE ${expenseWhere} AND status = 'APPROVED'`,
    expenseValues, tenantId
  );

  return {
    income: { amount: income?.total ?? 0, count: income?.count ?? 0 },
    expense: { amount: expense?.total ?? 0, count: expense?.count ?? 0 },
    balance: (income?.total ?? 0) - (expense?.total ?? 0)
  };
}

export async function getIncomeByCategory(tenantId: string, startDate?: string, endDate?: string) {
  const conditions = ["tenant_id = ?", "status = 'CONFIRMED'"];
  const values: unknown[] = [tenantId];
  if (startDate) { conditions.push("received_date >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("received_date <= ?"); values.push(endDate); }
  const where = conditions.join(" AND ");

  return queryWithTenant<any>(
    `SELECT receipt_type AS category, COALESCE(SUM(amount), 0) AS totalAmount, COUNT(*) AS count
     FROM t_receipt WHERE ${where}
     GROUP BY receipt_type ORDER BY totalAmount DESC`,
    values, tenantId
  );
}

export async function getExpenseByCategory(tenantId: string, startDate?: string, endDate?: string) {
  const conditions = ["tenant_id = ?", "status = 'APPROVED'"];
  const values: unknown[] = [tenantId];
  if (startDate) { conditions.push("expense_date >= ?"); values.push(startDate); }
  if (endDate) { conditions.push("expense_date <= ?"); values.push(endDate); }
  const where = conditions.join(" AND ");

  return queryWithTenant<any>(
    `SELECT expense_type AS category, COALESCE(SUM(amount), 0) AS totalAmount, COUNT(*) AS count
     FROM expense WHERE ${where}
     GROUP BY expense_type ORDER BY totalAmount DESC`,
    values, tenantId
  );
}