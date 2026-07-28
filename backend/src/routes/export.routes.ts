import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { priceResponseFilter } from "../middleware/price-guard";
import * as ctrl from "../controllers/admin/export.controller";

export const exportRouter = Router();

exportRouter.use(priceResponseFilter());

exportRouter.get("/customers", ctrl.exportCustomers);
exportRouter.get("/suppliers", ctrl.exportSuppliers);
exportRouter.get("/products", ctrl.exportProducts);
exportRouter.get("/inventory", ctrl.exportInventory);
exportRouter.get("/purchase-orders", ctrl.exportPurchaseOrders);
exportRouter.get("/payments", ctrl.exportPayments);
exportRouter.get("/sales-orders", ctrl.exportSalesOrders);
exportRouter.get("/audit-logs", ctrl.exportAuditLogs);
// ========== ·���Զ��������� ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/export",
  router: exportRouter,
  auth: "requireAuthWithTenant",
};
