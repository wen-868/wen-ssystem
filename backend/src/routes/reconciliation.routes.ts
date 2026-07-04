import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as reconciliationController from "../controllers/admin/reconciliation.controller.js";

export const reconciliationRouter = Router();
reconciliationRouter.get("/customer", requireAuthWithTenant, reconciliationController.getCustomerReconciliation);
reconciliationRouter.get("/customer/:customerId", requireAuthWithTenant, reconciliationController.getCustomerReconciliationDetail);
reconciliationRouter.post("/customer/:customerId/confirm", requireAuthWithTenant, reconciliationController.confirmCustomerReconciliation);
reconciliationRouter.get("/supplier", requireAuthWithTenant, reconciliationController.getSupplierReconciliation);
reconciliationRouter.get("/supplier/:supplierId", requireAuthWithTenant, reconciliationController.getSupplierReconciliationDetail);
reconciliationRouter.post("/supplier/:supplierId/confirm", requireAuthWithTenant, reconciliationController.confirmSupplierReconciliation);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/reconciliation",
  router: reconciliationRouter,
  auth: "requireAuthWithTenant",
};
