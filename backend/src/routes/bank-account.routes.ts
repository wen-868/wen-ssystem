import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

import * as bankAccountController from "../controllers/admin/bank-account.controller";

export const bankAccountRouter = Router();
bankAccountRouter.get("/", bankAccountController.listBankAccounts);
bankAccountRouter.get("/:id", bankAccountController.getBankAccount);
bankAccountRouter.post("/", bankAccountController.createBankAccount);
bankAccountRouter.put("/:id", bankAccountController.updateBankAccount);
bankAccountRouter.post("/:id/freeze", requirePermission("finance:create"), bankAccountController.freezeBankAccount);
bankAccountRouter.post("/:id/unfreeze", requirePermission("finance:create"), bankAccountController.unfreezeBankAccount);
bankAccountRouter.post("/:id/close", bankAccountController.closeBankAccount);
bankAccountRouter.get("/total/balance", bankAccountController.getTotalBalance);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/bank-accounts",
  router: bankAccountRouter,
  auth: "requireAuthWithTenant",
};
