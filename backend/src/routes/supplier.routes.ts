import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/supplier.controller";

export const supplierRouter = Router();

supplierRouter.get("/", asyncHandler(controller.listSuppliers));
supplierRouter.get("/:id", asyncHandler(controller.getSupplierDetail));
supplierRouter.post("/", asyncHandler(controller.createSupplier));
supplierRouter.put("/:id", asyncHandler(controller.updateSupplier));
supplierRouter.post("/:id/contacts", asyncHandler(controller.addSupplierContact));
supplierRouter.delete("/:id/contacts/:contactId", asyncHandler(controller.deleteSupplierContact));
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
