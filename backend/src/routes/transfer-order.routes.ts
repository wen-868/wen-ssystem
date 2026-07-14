import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import * as transferOrderV2Controller from "../controllers/admin/transfer-order-v2.controller";
import type { RouteConfig } from "../shared/auto-routes";

// ==================== 调拨单路由 ====================
export const transferOrderRouter = Router();

transferOrderRouter.get("/stats", requireAuthWithTenant, transferOrderV2Controller.getTransferStats);
transferOrderRouter.get("/:id", requireAuthWithTenant, transferOrderV2Controller.getTransferOrderDetail);
transferOrderRouter.put("/:id", requireAuthWithTenant, transferOrderV2Controller.updateTransferOrder);
transferOrderRouter.delete("/:id", requireAuthWithTenant, transferOrderV2Controller.deleteTransferOrder);
transferOrderRouter.post("/:id/approve", requireAuthWithTenant, transferOrderV2Controller.approveTransferOrder);
transferOrderRouter.post("/:id/reject", requireAuthWithTenant, transferOrderV2Controller.rejectTransferOrder);
transferOrderRouter.post("/:id/confirm-out", requireAuthWithTenant, transferOrderV2Controller.confirmTransferOut);
transferOrderRouter.post("/:id/confirm-in", requireAuthWithTenant, transferOrderV2Controller.confirmTransferIn);
transferOrderRouter.get("/", requireAuthWithTenant, transferOrderV2Controller.listTransferOrders);
transferOrderRouter.post("/", requireAuthWithTenant, transferOrderV2Controller.createTransferOrder);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/transfer-orders",
  router: transferOrderRouter,
  auth: "requireAuthWithTenant",
};
