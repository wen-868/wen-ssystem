import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as reconciliationController from "../controllers/admin/reconciliation.controller";

export const reconciliationRouter = Router();
reconciliationRouter.get("/customer", reconciliationController.getCustomerReconciliation);
reconciliationRouter.get("/customer/:customerId", reconciliationController.getCustomerReconciliationDetail);
reconciliationRouter.post("/customer/:customerId/confirm", reconciliationController.confirmCustomerReconciliation);
reconciliationRouter.get("/supplier", reconciliationController.getSupplierReconciliation);
reconciliationRouter.get("/supplier/:supplierId", reconciliationController.getSupplierReconciliationDetail);
reconciliationRouter.post("/supplier/:supplierId/confirm", reconciliationController.confirmSupplierReconciliation);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/reconciliation",
  router: reconciliationRouter,
  auth: "requireAuthWithTenant",
};
