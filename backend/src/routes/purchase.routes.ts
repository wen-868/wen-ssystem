import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";
import * as controller from "../controllers/admin/purchase.controller";

export const purchaseRouter = Router();

purchaseRouter.get("/", asyncHandler(controller.listPurchaseOrders));
purchaseRouter.get("/:orderNo", asyncHandler(controller.getPurchaseOrderDetail));
// ⚠️ S3-214-B2 **本行不接线**：移动端「销售开单」采购页签无权限门（app-mobile/src/pages/sales/create-sale.vue:23），
//    接线会把持有 sale:bill 的门店角色由「可用」打成 403 ⇒ 登记「待移动端补权限门后收编」（见缺口清单 §十一）。
purchaseRouter.post("/", asyncHandler(controller.createPurchaseOrder));
purchaseRouter.post("/:orderNo/submit", requirePermission("purchase:create"), asyncHandler(controller.submitPurchaseOrder));
purchaseRouter.post("/:orderNo/approve", requirePermission("purchase:approve"), asyncHandler(controller.approvePurchaseOrder));
purchaseRouter.post("/:orderNo/cancel", requirePermission("purchase:create"), asyncHandler(controller.cancelPurchaseOrder));
purchaseRouter.put("/:orderNo", requirePermission("purchase:create"), asyncHandler(controller.updatePurchaseOrder));
purchaseRouter.delete("/:orderNo", requirePermission("purchase:create"), asyncHandler(controller.deletePurchaseOrder));
purchaseRouter.post("/:orderNo/in-stock", requirePermission("purchase:create"), asyncHandler(controller.purchaseInStock));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-orders",
  router: purchaseRouter,
  auth: "requireAuthWithTenant",
};
