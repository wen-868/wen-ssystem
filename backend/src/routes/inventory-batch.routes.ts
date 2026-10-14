import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as controller from "../controllers/admin/inventory-batch.controller";
import { startExpiryScanner } from "../shared/expiry-scanner";
import { requirePermission } from "../middleware/rbac-auth";

startExpiryScanner();

export const inventoryBatchRouter = Router();

// ==================== 批次管理 ====================

inventoryBatchRouter.get("/batches", controller.listBatches);
inventoryBatchRouter.get("/batches/fifo-suggestion/:storeId/:skuId", controller.getFifoSuggestion);
inventoryBatchRouter.get("/batches/:id", controller.getBatchDetail);
// S3-198 批B2-2（库存/追溯域）：批次写动作按台账 §三.12 建议码接线（新增/拆分 ⇒ inventory:create，变更 ⇒ inventory:adjust）。
// 持有者（仓库种子）= STORE_MANAGER（inventory:*）/ WAREHOUSE_STAFF（inventory:*）/ SUPER_ADMIN、OPERATION_ADMIN（*）；
// 调用页 = 库存批次 InventoryBatch.vue（router/index.ts:142，roles [SUPER_ADMIN]）⇒ 页面角色 ⊆ 持有者。
// 备注：create/update/split 三个 API 函数全仓零页面调用点（仅 admin-web/src/api/inventory.ts 导出）。
inventoryBatchRouter.post("/batches", requirePermission("inventory:create"), controller.createBatch);
inventoryBatchRouter.put("/batches/:id", requirePermission("inventory:adjust"), controller.updateBatch);
inventoryBatchRouter.post("/batches/:id/split", requirePermission("inventory:create"), controller.splitBatch);

// ==================== 批次追溯 ====================

inventoryBatchRouter.get("/batches/:id/trace", controller.getBatchTrace);
inventoryBatchRouter.get("/products/:spuId/batches", controller.getProductBatches);

// ==================== 效期预警配置 ====================

inventoryBatchRouter.get("/expiry-configs", controller.listExpiryConfigs);
inventoryBatchRouter.post("/expiry-configs", requirePermission("inventory:create"), controller.createExpiryConfig);
inventoryBatchRouter.put("/expiry-configs/:id", requirePermission("inventory:adjust"), controller.updateExpiryConfig);
inventoryBatchRouter.delete("/expiry-configs/:id", requirePermission("inventory:adjust"), controller.deleteExpiryConfig);

// ==================== 效期预警记录 ====================

inventoryBatchRouter.get("/expiry-alerts", controller.listExpiryAlerts);
inventoryBatchRouter.get("/expiry-alerts/statistics", controller.getExpiryAlertStatistics);
inventoryBatchRouter.put("/expiry-alerts/:id/handle", requirePermission("inventory:adjust"), controller.handleExpiryAlert);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/inventory-batch",
  router: inventoryBatchRouter,
  auth: "requireAuthWithTenant",
};
