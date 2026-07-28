import { Router } from "express";
import * as transferOrderV2Controller from "../controllers/admin/transfer-order-v2.controller";
import type { RouteConfig } from "../shared/auto-routes";

// ==================== 调拨单路由 ====================
export const transferOrderRouter = Router();

transferOrderRouter.get("/stats", transferOrderV2Controller.getTransferStats);
transferOrderRouter.get("/:id", transferOrderV2Controller.getTransferOrderDetail);
transferOrderRouter.put("/:id", transferOrderV2Controller.updateTransferOrder);
transferOrderRouter.delete("/:id", transferOrderV2Controller.deleteTransferOrder);
transferOrderRouter.post("/:id/approve", transferOrderV2Controller.approveTransferOrder);
transferOrderRouter.post("/:id/reject", transferOrderV2Controller.rejectTransferOrder);
transferOrderRouter.post("/:id/confirm-out", transferOrderV2Controller.confirmTransferOut);
transferOrderRouter.post("/:id/confirm-in", transferOrderV2Controller.confirmTransferIn);
transferOrderRouter.get("/", transferOrderV2Controller.listTransferOrders);
transferOrderRouter.post("/", transferOrderV2Controller.createTransferOrder);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/transfer-orders",
  router: transferOrderRouter,
  auth: "requireAuthWithTenant",
};
