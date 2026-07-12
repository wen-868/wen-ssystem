import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/supplier.controller";

export const supplierRouter = Router();

supplierRouter.get("/", requireAuthWithTenant, asyncHandler(controller.listSuppliers));
supplierRouter.get("/:id", requireAuthWithTenant, asyncHandler(controller.getSupplierDetail));
supplierRouter.post("/", requireAuthWithTenant, asyncHandler(controller.createSupplier));
supplierRouter.put("/:id", requireAuthWithTenant, asyncHandler(controller.updateSupplier));
supplierRouter.post("/:id/contacts", requireAuthWithTenant, asyncHandler(controller.addSupplierContact));
supplierRouter.delete("/:id/contacts/:contactId", requireAuthWithTenant, asyncHandler(controller.deleteSupplierContact));
supplierRouter.get("/:id/purchase-orders", requireAuthWithTenant, asyncHandler(controller.getSupplierPurchaseOrders));
supplierRouter.get("/:id/payments", requireAuthWithTenant, asyncHandler(controller.getSupplierPayments));
supplierRouter.get("/:id/products", requireAuthWithTenant, asyncHandler(controller.getSupplierProducts));
supplierRouter.get("/:id/stats", requireAuthWithTenant, asyncHandler(controller.getSupplierStats));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/suppliers",
  router: supplierRouter,
  auth: "requireAuthWithTenant",
};
