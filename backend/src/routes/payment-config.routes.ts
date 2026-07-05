import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as ctrl from "../controllers/admin/payment-config.controller.js";

export const paymentConfigRouter = Router();

paymentConfigRouter.get("/configs/:provider", requireAuthWithTenant, ctrl.getChannelConfig);
paymentConfigRouter.put("/configs/:provider", requireAuthWithTenant, ctrl.saveChannelConfig);
paymentConfigRouter.post("/configs/:provider/test", requireAuthWithTenant, ctrl.testConnection);
paymentConfigRouter.get("/status", requireAuthWithTenant, ctrl.getStatus);
paymentConfigRouter.get("/bank-accounts", requireAuthWithTenant, ctrl.listBankAccounts);
paymentConfigRouter.post("/bank-accounts", requireAuthWithTenant, ctrl.createBankAccount);
paymentConfigRouter.put("/bank-accounts/:id", requireAuthWithTenant, ctrl.updateBankAccount);
paymentConfigRouter.delete("/bank-accounts/:id", requireAuthWithTenant, ctrl.deleteBankAccount);
paymentConfigRouter.post("/bank-accounts/:id/default", requireAuthWithTenant, ctrl.setDefaultBankAccount);