import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

import * as bankAccountController from "../controllers/admin/bank-account.controller";

export const bankAccountRouter = Router();
bankAccountRouter.get("/", bankAccountController.listBankAccounts);
bankAccountRouter.get("/:id", bankAccountController.getBankAccount);
// S3-223（财务域接线 · B2 批 5）：本文件 3 行新增/注销类端点里，**只有 PUT /:id 接线**。
// 码选择 = 本文件 G1 既有码 `finance:create`（域内页面 `admin-web/src/router/index.ts:203`
// `bank-accounts` 门禁 [SUPER_ADMIN]，调用点 `views/finance/BankAccounts.vue:294`，零回归）。
// S3-233（B 类收编第一批 · 财务域）：上述"本批不接"的两行（`POST /`、`POST /:id/close`）前提
//   （app-mobile 门店管理页经「我的」页**无条件**入口可达 ⇒ 角色集不可枚举）已由 S3-230 的入口权限门修复
//   （门 = permission-gates.ts 的 `fin-bank-accounts`，门码 `finance:create`）⇒ 本批按注册表收编，同 :18-20 同码。
//   零回归：`finance:create` 持有人 = 超管 / 运营（`*`）+ 财务（`finance:*`）；门店角色看不到该入口。
bankAccountRouter.post("/", requirePermission("finance:create"), bankAccountController.createBankAccount);
bankAccountRouter.put("/:id", requirePermission("finance:create"), bankAccountController.updateBankAccount);
bankAccountRouter.post("/:id/freeze", requirePermission("finance:create"), bankAccountController.freezeBankAccount);
bankAccountRouter.post("/:id/unfreeze", requirePermission("finance:create"), bankAccountController.unfreezeBankAccount);
bankAccountRouter.post("/:id/close", requirePermission("finance:create"), bankAccountController.closeBankAccount);
bankAccountRouter.get("/total/balance", bankAccountController.getTotalBalance);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/bank-accounts",
  router: bankAccountRouter,
  auth: "requireAuthWithTenant",
};
