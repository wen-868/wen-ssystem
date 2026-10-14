import { Router } from "express";
import * as transferOrderV2Controller from "../controllers/admin/transfer-order-v2.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

// ==================== 调拨单路由 ====================
export const transferOrderRouter = Router();

transferOrderRouter.get("/stats", transferOrderV2Controller.getTransferStats);
transferOrderRouter.get("/:id", transferOrderV2Controller.getTransferOrderDetail);
// S3-198 批B2-2（库存/追溯域）：调拨单（v2）写动作按台账 §三.12 建议码接线
// （单据增删改与出入库确认 ⇒ store:transfer；审批 ⇒ inventory:approve）。
// 持有者（仓库种子）= 店长 STORE_MANAGER（store:* / inventory:*）、WAREHOUSE_STAFF（inventory:*）/
// SUPER_ADMIN、OPERATION_ADMIN（*）；调用点 = **零**（全仓无任何前端调用 /api/admin/transfer-orders）⇒ 无页面角色被 403。
transferOrderRouter.put("/:id", requirePermission("store:transfer"), transferOrderV2Controller.updateTransferOrder);
transferOrderRouter.delete("/:id", requirePermission("store:transfer"), transferOrderV2Controller.deleteTransferOrder);
transferOrderRouter.post("/:id/approve", requirePermission("inventory:approve"), transferOrderV2Controller.approveTransferOrder);
transferOrderRouter.post("/:id/reject", requirePermission("inventory:approve"), transferOrderV2Controller.rejectTransferOrder);
transferOrderRouter.post("/:id/confirm-out", requirePermission("store:transfer"), transferOrderV2Controller.confirmTransferOut);
transferOrderRouter.post("/:id/confirm-in", requirePermission("store:transfer"), transferOrderV2Controller.confirmTransferIn);
transferOrderRouter.get("/", transferOrderV2Controller.listTransferOrders);
transferOrderRouter.post("/", requirePermission("store:transfer"), transferOrderV2Controller.createTransferOrder);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/transfer-orders",
  router: transferOrderRouter,
  auth: "requireAuthWithTenant",
};
