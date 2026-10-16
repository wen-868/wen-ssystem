import { Router } from "express";

import * as transferOrderController from "../controllers/admin/transfer-order.controller";
import * as adminTransferExecutionController from "../controllers/admin/transfer-execution.controller";
import * as storeTransferExecutionController from "../controllers/store/transfer-execution.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

// S3-233（B 类收编第一批 · 库存/追溯域）：调拨单 v1 族（本文件）接线，统一挂 `store:transfer`。
// 依据门 = permission-gates.ts 的 `fx-transfer`（功能中心「门店调拨」入口）与 `fx-transfer-receive`
//（调拨单「门店收货」按钮），两门码均为 `store:transfer`；同族先例 = `transfer-order.routes.ts`（调拨单 v2）
// 的创建/更新/执行行（S3-198 批 1 已挂 `store:transfer`，见缺口清单 §9.2 第 16/17/20-22 行）。
// 使用者：店长（`store:*`）与仓管（`transfer:*` 不覆盖 `store:transfer` ⇒ 仓管经本门不再看到该入口，**报备项**）。

// ==================== Admin 调拨路由 ====================
export const adminTransferRouter = Router();

// 调拨单
adminTransferRouter.post("/", requirePermission("store:transfer"), transferOrderController.createTransferOrder);
adminTransferRouter.get("/", transferOrderController.listTransferOrders);
adminTransferRouter.get("/statistics", transferOrderController.getTransferStatistics);
adminTransferRouter.get("/trend", transferOrderController.getTransferTrend);
adminTransferRouter.get("/:id", transferOrderController.getTransferOrderDetail);
adminTransferRouter.put("/:id", requirePermission("store:transfer"), transferOrderController.updateTransferOrder);
adminTransferRouter.post("/:id/submit", requirePermission("store:transfer"), transferOrderController.submitTransferOrder);
adminTransferRouter.post("/:id/approve", requirePermission("store:transfer"), transferOrderController.approveTransferOrder);
adminTransferRouter.post("/:id/reject", requirePermission("store:transfer"), transferOrderController.rejectTransferOrder);

// 调拨执行
adminTransferRouter.post("/:id/cancel", requirePermission("store:transfer"), adminTransferExecutionController.cancelTransferOrder);
adminTransferRouter.post("/:id/ship", requirePermission("store:transfer"), adminTransferExecutionController.shipTransferOrder);

// ==================== Store 调拨路由 ====================
export const storeTransferRouter = Router();

storeTransferRouter.post("/:id/receive", requirePermission("store:transfer"), storeTransferExecutionController.receiveTransferOrder);
storeTransferRouter.get("/in-transit", storeTransferExecutionController.getInTransitOrders);
storeTransferRouter.get("/my-shipments", storeTransferExecutionController.getMyShipments);

// ========== 路由自动发现配置 ==========
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/admin/transfers", router: adminTransferRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/transfers", router: storeTransferRouter, auth: "requireAuthWithTenant" },
];
