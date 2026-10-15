import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

import * as expenseController from "../controllers/admin/expense.controller";

export const expenseRouter = Router();
expenseRouter.post("/", requirePermission("finance:create"), expenseController.createExpense);
expenseRouter.get("/", expenseController.listExpenses);
expenseRouter.get("/summary", expenseController.getExpenseSummary);
expenseRouter.get("/:expenseNo", expenseController.getExpenseDetail);
// S3-223（财务域接线 · B2 批 5）：改/审/作废 3 行挂**同文件 G2 既有码** `finance:create`
//（`POST /` 自 S3-125 起即此码，口径一致）。持有者（生产实测）＝ 超管/运营（`*`）+ FINANCE_STAFF
//（`finance:*`）；使用者 = 桌面 `views/finance/ExpensesView.vue:362/374/384`
//（页面门禁 `router/index.ts:200` [SUPER_ADMIN]）+ app-mobile 费用支出页
//（`pages-sub/finance/finance/expenses.vue:178`、`finances/expense-detail.vue:108/131`，
// 模块前缀 `finance`，见 `function-menu.ts:94`）⇒ 页面角色 ⊆ 持有人，零回归。
expenseRouter.put("/:expenseNo", requirePermission("finance:create"), expenseController.updateExpense);
expenseRouter.post("/:expenseNo/approve", requirePermission("finance:create"), expenseController.approveExpense);
expenseRouter.post("/:expenseNo/void", requirePermission("finance:create"), expenseController.voidExpense);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/expenses",
  router: expenseRouter,
  auth: "requireAuthWithTenant",
};
