import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/purchase.controller";

export const purchaseRouter = Router();

purchaseRouter.get("/", asyncHandler(controller.listPurchaseOrders));
purchaseRouter.get("/:orderNo", asyncHandler(controller.getPurchaseOrderDetail));
purchaseRouter.post("/", asyncHandler(controller.createPurchaseOrder));
purchaseRouter.post("/:orderNo/submit", asyncHandler(controller.submitPurchaseOrder));
purchaseRouter.post("/:orderNo/approve", asyncHandler(controller.approvePurchaseOrder));
purchaseRouter.post("/:orderNo/cancel", asyncHandler(controller.cancelPurchaseOrder));
purchaseRouter.put("/:orderNo", asyncHandler(controller.updatePurchaseOrder));
purchaseRouter.delete("/:orderNo", asyncHandler(controller.deletePurchaseOrder));
purchaseRouter.post("/:orderNo/in-stock", asyncHandler(controller.purchaseInStock));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-orders",
  router: purchaseRouter,
  auth: "requireAuthWithTenant",
};
