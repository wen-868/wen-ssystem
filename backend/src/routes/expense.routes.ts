import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as expenseController from "../controllers/admin/expense.controller";

export const expenseRouter = Router();
expenseRouter.post("/", expenseController.createExpense);
expenseRouter.get("/", expenseController.listExpenses);
expenseRouter.get("/summary", expenseController.getExpenseSummary);
expenseRouter.get("/:expenseNo", expenseController.getExpenseDetail);
expenseRouter.put("/:expenseNo", expenseController.updateExpense);
expenseRouter.post("/:expenseNo/approve", expenseController.approveExpense);
expenseRouter.post("/:expenseNo/void", expenseController.voidExpense);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/expenses",
  router: expenseRouter,
  auth: "requireAuthWithTenant",
};
