import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as reconciliationController from "../controllers/admin/reconciliation.controller.js";

export const reconciliationRouter = Router();
reconciliationRouter.get("/customer", requireAuthWithTenant, reconciliationController.getCustomerReconciliation);
reconciliationRouter.get("/customer/:customerId", requireAuthWithTenant, reconciliationController.getCustomerReconciliationDetail);
reconciliationRouter.post("/customer/:customerId/confirm", requireAuthWithTenant, reconciliationController.confirmCustomerReconciliation);
reconciliationRouter.get("/supplier", requireAuthWithTenant, reconciliationController.getSupplierReconciliation);
reconciliationRouter.get("/supplier/:supplierId", requireAuthWithTenant, reconciliationController.getSupplierReconciliationDetail);
reconciliationRouter.post("/supplier/:supplierId/confirm", requireAuthWithTenant, reconciliationController.confirmSupplierReconciliation);