import { Router } from "express";

import * as transferOrderController from "../controllers/admin/transfer-order.controller";
import * as adminTransferExecutionController from "../controllers/admin/transfer-execution.controller";
import * as storeTransferExecutionController from "../controllers/store/transfer-execution.controller";
import type { RouteConfig } from "../shared/auto-routes";

// ==================== Admin 调拨路由 ====================
export const adminTransferRouter = Router();

// 调拨单
adminTransferRouter.post("/", transferOrderController.createTransferOrder);
adminTransferRouter.get("/", transferOrderController.listTransferOrders);
adminTransferRouter.get("/statistics", transferOrderController.getTransferStatistics);
adminTransferRouter.get("/trend", transferOrderController.getTransferTrend);
adminTransferRouter.get("/:id", transferOrderController.getTransferOrderDetail);
adminTransferRouter.put("/:id", transferOrderController.updateTransferOrder);
adminTransferRouter.post("/:id/submit", transferOrderController.submitTransferOrder);
adminTransferRouter.post("/:id/approve", transferOrderController.approveTransferOrder);
adminTransferRouter.post("/:id/reject", transferOrderController.rejectTransferOrder);

// 调拨执行
adminTransferRouter.post("/:id/cancel", adminTransferExecutionController.cancelTransferOrder);
adminTransferRouter.post("/:id/ship", adminTransferExecutionController.shipTransferOrder);

// ==================== Store 调拨路由 ====================
export const storeTransferRouter = Router();

storeTransferRouter.post("/:id/receive", storeTransferExecutionController.receiveTransferOrder);
storeTransferRouter.get("/in-transit", storeTransferExecutionController.getInTransitOrders);
storeTransferRouter.get("/my-shipments", storeTransferExecutionController.getMyShipments);

// ========== 路由自动发现配置 ==========
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/admin/transfers", router: adminTransferRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/transfers", router: storeTransferRouter, auth: "requireAuthWithTenant" },
];
