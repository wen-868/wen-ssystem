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
// ⚠️ 同文件 `POST /`、`POST /:id/close` **本批不接**：二者有 app-mobile 写调用点
// （`pages-sub/admin/stores/stores.vue:241 / :263` → `api/modules/stores.ts:141 / :146`），
// 且该页经「我的」页无条件入口可达（角色集不可枚举）⇒ 已被 `rbac-g1-wiring.test.ts:273-274`
// 与 `rbac-g2-wiring.test.ts:232-254` 锁定为「B 类待裁」，本批不自行改口径（见回执 §三.1）。
bankAccountRouter.post("/", bankAccountController.createBankAccount);
bankAccountRouter.put("/:id", requirePermission("finance:create"), bankAccountController.updateBankAccount);
bankAccountRouter.post("/:id/freeze", requirePermission("finance:create"), bankAccountController.freezeBankAccount);
bankAccountRouter.post("/:id/unfreeze", requirePermission("finance:create"), bankAccountController.unfreezeBankAccount);
bankAccountRouter.post("/:id/close", bankAccountController.closeBankAccount);
bankAccountRouter.get("/total/balance", bankAccountController.getTotalBalance);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/bank-accounts",
  router: bankAccountRouter,
  auth: "requireAuthWithTenant",
};
