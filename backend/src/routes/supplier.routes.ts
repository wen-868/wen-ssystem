import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";
import * as controller from "../controllers/admin/supplier.controller";

export const supplierRouter = Router();

supplierRouter.get("/", asyncHandler(controller.listSuppliers));
supplierRouter.get("/:id", asyncHandler(controller.getSupplierDetail));
supplierRouter.post("/", requirePermission("purchase:supplier"), asyncHandler(controller.createSupplier));
supplierRouter.put("/:id", requirePermission("purchase:supplier"), asyncHandler(controller.updateSupplier));
supplierRouter.post("/:id/contacts", requirePermission("purchase:supplier"), asyncHandler(controller.addSupplierContact));
supplierRouter.delete("/:id/contacts/:contactId", requirePermission("purchase:supplier"), asyncHandler(controller.deleteSupplierContact));
supplierRouter.get("/:id/purchase-orders", asyncHandler(controller.getSupplierPurchaseOrders));
supplierRouter.get("/:id/payments", asyncHandler(controller.getSupplierPayments));
supplierRouter.get("/:id/products", asyncHandler(controller.getSupplierProducts));
supplierRouter.get("/:id/stats", asyncHandler(controller.getSupplierStats));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/suppliers",
  router: supplierRouter,
  auth: "requireAuthWithTenant",
};
