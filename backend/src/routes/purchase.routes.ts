import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";
import * as controller from "../controllers/admin/purchase.controller";

export const purchaseRouter = Router();

purchaseRouter.get("/", asyncHandler(controller.listPurchaseOrders));
purchaseRouter.get("/:orderNo", asyncHandler(controller.getPurchaseOrderDetail));
// S3-233（B 类收编第一批 · 采购域）：创建采购单挂 `purchase:create`。
// 依据门 = app-mobile/src/config/permission-gates.ts 的 `purchase-sub-order`（开单页「采购 → 采购订单」子段，
// 入口已按该码显隐）；同文件 submit/cancel/PUT/DELETE/in-stock 早已挂同码（:15/:17-20）。
// S3-214-B2 的「待移动端补权限门后收编」前提（create-sale.vue 页签无门）已由 S3-230 修复，故本行据此收编。
purchaseRouter.post("/", requirePermission("purchase:create"), asyncHandler(controller.createPurchaseOrder));
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
