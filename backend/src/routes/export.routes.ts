import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/export.controller.js";

export const exportRouter = Router();

exportRouter.get("/customers", requireAuthWithTenant, ctrl.exportCustomers);
exportRouter.get("/suppliers", requireAuthWithTenant, ctrl.exportSuppliers);
exportRouter.get("/products", requireAuthWithTenant, ctrl.exportProducts);
exportRouter.get("/inventory", requireAuthWithTenant, ctrl.exportInventory);
exportRouter.get("/purchase-orders", requireAuthWithTenant, ctrl.exportPurchaseOrders);
exportRouter.get("/payments", requireAuthWithTenant, ctrl.exportPayments);
exportRouter.get("/sales-orders", requireAuthWithTenant, ctrl.exportSalesOrders);
exportRouter.get("/audit-logs", requireAuthWithTenant, ctrl.exportAuditLogs);