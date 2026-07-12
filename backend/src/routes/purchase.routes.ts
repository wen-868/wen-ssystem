import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/purchase.controller";

export const purchaseRouter = Router();

purchaseRouter.get("/", requireAuthWithTenant, asyncHandler(controller.listPurchaseOrders));
purchaseRouter.get("/:orderNo", requireAuthWithTenant, asyncHandler(controller.getPurchaseOrderDetail));
purchaseRouter.post("/", requireAuthWithTenant, asyncHandler(controller.createPurchaseOrder));
purchaseRouter.post("/:orderNo/submit", requireAuthWithTenant, asyncHandler(controller.submitPurchaseOrder));
purchaseRouter.post("/:orderNo/approve", requireAuthWithTenant, asyncHandler(controller.approvePurchaseOrder));
purchaseRouter.post("/:orderNo/cancel", requireAuthWithTenant, asyncHandler(controller.cancelPurchaseOrder));
purchaseRouter.put("/:orderNo", requireAuthWithTenant, asyncHandler(controller.updatePurchaseOrder));
purchaseRouter.delete("/:orderNo", requireAuthWithTenant, asyncHandler(controller.deletePurchaseOrder));
purchaseRouter.post("/:orderNo/in-stock", requireAuthWithTenant, asyncHandler(controller.purchaseInStock));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-orders",
  router: purchaseRouter,
  auth: "requireAuthWithTenant",
};
