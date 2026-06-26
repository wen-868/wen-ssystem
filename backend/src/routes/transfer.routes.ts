import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as transferOrderController from "../controllers/admin/transfer-order.controller.js";
import * as adminTransferExecutionController from "../controllers/admin/transfer-execution.controller.js";
import * as storeTransferExecutionController from "../controllers/store/transfer-execution.controller.js";

// ==================== Admin 调拨路由 ====================
export const adminTransferRouter = Router();

adminTransferRouter.use(requireAuthWithTenant);

// POST / - 创建调拨单
adminTransferRouter.post("/", transferOrderController.createTransferOrder);

// GET / - 调拨单列表
adminTransferRouter.get("/", transferOrderController.listTransferOrders);

// GET /statistics - 调拨统计
adminTransferRouter.get("/statistics", transferOrderController.getTransferStatistics);

// GET /:id - 调拨单详情
adminTransferRouter.get("/:id", transferOrderController.getTransferOrderDetail);

// PUT /:id - 更新调拨单(仅DRAFT)
adminTransferRouter.put("/:id", transferOrderController.updateTransferOrder);

// POST /:id/submit - 提交审核
adminTransferRouter.post("/:id/submit", transferOrderController.submitTransferOrder);

// POST /:id/approve - 审核通过
adminTransferRouter.post("/:id/approve", transferOrderController.approveTransferOrder);

// POST /:id/reject - 审核拒绝(退回DRAFT)
adminTransferRouter.post("/:id/reject", transferOrderController.rejectTransferOrder);

// POST /:id/cancel - 取消
adminTransferRouter.post("/:id/cancel", adminTransferExecutionController.cancelTransferOrder);

// POST /:id/ship - 发货出库
adminTransferRouter.post("/:id/ship", adminTransferExecutionController.shipTransferOrder);

// ==================== Store 调拨路由 ====================
export const storeTransferRouter = Router();

// POST /:id/receive - 收货入库
storeTransferRouter.post("/:id/receive", storeTransferExecutionController.receiveTransferOrder);

// GET /in-transit - 当前门店在途调拨单(作为调入方)
storeTransferRouter.get("/in-transit", storeTransferExecutionController.getInTransitOrders);

// GET /my-shipments - 当前门店已发货调拨单(作为调出方)
storeTransferRouter.get("/my-shipments", storeTransferExecutionController.getMyShipments);
