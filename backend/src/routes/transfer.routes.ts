import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as transferOrderController from "../controllers/admin/transfer-order.controller.js";
import * as adminTransferExecutionController from "../controllers/admin/transfer-execution.controller.js";
import * as storeTransferExecutionController from "../controllers/store/transfer-execution.controller.js";

// ==================== Admin 调拨路由 ====================
export const adminTransferRouter = Router();

// 调拨单
adminTransferRouter.post("/", requireAuthWithTenant, transferOrderController.createTransferOrder);
adminTransferRouter.get("/", requireAuthWithTenant, transferOrderController.listTransferOrders);
adminTransferRouter.get("/statistics", requireAuthWithTenant, transferOrderController.getTransferStatistics);
adminTransferRouter.get("/:id", requireAuthWithTenant, transferOrderController.getTransferOrderDetail);
adminTransferRouter.put("/:id", requireAuthWithTenant, transferOrderController.updateTransferOrder);
adminTransferRouter.post("/:id/submit", requireAuthWithTenant, transferOrderController.submitTransferOrder);
adminTransferRouter.post("/:id/approve", requireAuthWithTenant, transferOrderController.approveTransferOrder);
adminTransferRouter.post("/:id/reject", requireAuthWithTenant, transferOrderController.rejectTransferOrder);

// 调拨执行
adminTransferRouter.post("/:id/cancel", requireAuthWithTenant, adminTransferExecutionController.cancelTransferOrder);
adminTransferRouter.post("/:id/ship", requireAuthWithTenant, adminTransferExecutionController.shipTransferOrder);

// ==================== Store 调拨路由 ====================
export const storeTransferRouter = Router();

storeTransferRouter.post("/:id/receive", storeTransferExecutionController.receiveTransferOrder);
storeTransferRouter.get("/in-transit", storeTransferExecutionController.getInTransitOrders);
storeTransferRouter.get("/my-shipments", storeTransferExecutionController.getMyShipments);