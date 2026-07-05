import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as expenseService from "../../services/admin/expense.service.js";

export const createExpense = asyncHandler(async (req, res) => {
  const { expenseType, category, amount, payee, paymentMethod, bankAccountId, invoiceNo, expenseDate, remark } = req.body;
  res.json(ok(await expenseService.createExpense({ expenseType, category, amount, payee, paymentMethod, bankAccountId, invoiceNo, expenseDate, remark, operatorId: req.user!.id, tenantId: req.tenantId! })));
});
export const listExpenses = asyncHandler(async (req, res) => {
  res.json(ok(await expenseService.listExpenses({ expenseType: req.query.expenseType as string | undefined, status: req.query.status as string | undefined, page: Number(req.query.page || 1), pageSize: Number(req.query.pageSize || 20), tenantId: req.tenantId! })));
});
export const getExpenseDetail = asyncHandler(async (req, res) => { res.json(ok(await expenseService.getExpenseDetail(req.params.expenseNo, req.tenantId!))); });
export const updateExpense = asyncHandler(async (req, res) => {
  const { expenseType, category, amount, payee, paymentMethod, expenseDate, remark } = req.body;
  res.json(ok(await expenseService.updateExpense(req.params.expenseNo, { expenseType, category, amount, payee, paymentMethod, expenseDate, remark, tenantId: req.tenantId! })));
});
export const approveExpense = asyncHandler(async (req, res) => { res.json(ok(await expenseService.approveExpense(req.params.expenseNo, req.tenantId!))); });
export const voidExpense = asyncHandler(async (req, res) => { res.json(ok(await expenseService.voidExpense(req.params.expenseNo, req.tenantId!))); });
export const getExpenseSummary = asyncHandler(async (req, res) => {
  res.json(ok(await expenseService.getExpenseSummary(req.tenantId!, req.query.startDate as string | undefined, req.query.endDate as string | undefined)));
});