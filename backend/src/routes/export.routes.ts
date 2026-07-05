import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { priceResponseFilter } from "../middleware/price-guard.js";
import * as ctrl from "../controllers/export.controller.js";

export const exportRouter = Router();

exportRouter.use(priceResponseFilter());

exportRouter.get("/customers", requireAuthWithTenant, ctrl.exportCustomers);
exportRouter.get("/suppliers", requireAuthWithTenant, ctrl.exportSuppliers);
exportRouter.get("/products", requireAuthWithTenant, ctrl.exportProducts);
exportRouter.get("/inventory", requireAuthWithTenant, ctrl.exportInventory);
exportRouter.get("/purchase-orders", requireAuthWithTenant, ctrl.exportPurchaseOrders);
exportRouter.get("/payments", requireAuthWithTenant, ctrl.exportPayments);
exportRouter.get("/sales-orders", requireAuthWithTenant, ctrl.exportSalesOrders);
exportRouter.get("/audit-logs", requireAuthWithTenant, ctrl.exportAuditLogs);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/export",
  router: exportRouter,
  auth: "requireAuthWithTenant",
};
