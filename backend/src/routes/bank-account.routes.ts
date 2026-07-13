import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as bankAccountController from "../controllers/admin/bank-account.controller";

export const bankAccountRouter = Router();
bankAccountRouter.get("/", requireAuthWithTenant, bankAccountController.listBankAccounts);
bankAccountRouter.get("/:id", requireAuthWithTenant, bankAccountController.getBankAccount);
bankAccountRouter.post("/", requireAuthWithTenant, bankAccountController.createBankAccount);
bankAccountRouter.put("/:id", requireAuthWithTenant, bankAccountController.updateBankAccount);
bankAccountRouter.post("/:id/freeze", requireAuthWithTenant, bankAccountController.freezeBankAccount);
bankAccountRouter.post("/:id/unfreeze", requireAuthWithTenant, bankAccountController.unfreezeBankAccount);
bankAccountRouter.post("/:id/close", requireAuthWithTenant, bankAccountController.closeBankAccount);
bankAccountRouter.get("/total/balance", requireAuthWithTenant, bankAccountController.getTotalBalance);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/bank-accounts",
  router: bankAccountRouter,
  auth: "requireAuthWithTenant",
};
