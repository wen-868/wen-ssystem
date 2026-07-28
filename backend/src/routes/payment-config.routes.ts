import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/admin/payment-config.controller";

export const paymentConfigRouter = Router();

paymentConfigRouter.get("/configs/:provider", ctrl.getChannelConfig);
paymentConfigRouter.put("/configs/:provider", ctrl.saveChannelConfig);
paymentConfigRouter.post("/configs/:provider/test", ctrl.testConnection);
paymentConfigRouter.get("/status", ctrl.getStatus);
paymentConfigRouter.get("/bank-accounts", ctrl.listBankAccounts);
paymentConfigRouter.post("/bank-accounts", ctrl.createBankAccount);
paymentConfigRouter.put("/bank-accounts/:id", ctrl.updateBankAccount);
paymentConfigRouter.delete("/bank-accounts/:id", ctrl.deleteBankAccount);
paymentConfigRouter.post("/bank-accounts/:id/default", ctrl.setDefaultBankAccount);

export const routeConfig: RouteConfig = {
  prefix: "/api/payment-config",
  router: paymentConfigRouter,
  auth: "requireAuthWithTenant",
};
