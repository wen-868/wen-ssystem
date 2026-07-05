import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as expenseController from "../controllers/admin/expense.controller.js";

export const expenseRouter = Router();
expenseRouter.post("/", requireAuthWithTenant, expenseController.createExpense);
expenseRouter.get("/", requireAuthWithTenant, expenseController.listExpenses);
expenseRouter.get("/summary", requireAuthWithTenant, expenseController.getExpenseSummary);
expenseRouter.get("/:expenseNo", requireAuthWithTenant, expenseController.getExpenseDetail);
expenseRouter.put("/:expenseNo", requireAuthWithTenant, expenseController.updateExpense);
expenseRouter.post("/:expenseNo/approve", requireAuthWithTenant, expenseController.approveExpense);
expenseRouter.post("/:expenseNo/void", requireAuthWithTenant, expenseController.voidExpense);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/expenses",
  router: expenseRouter,
  auth: "requireAuthWithTenant",
};
