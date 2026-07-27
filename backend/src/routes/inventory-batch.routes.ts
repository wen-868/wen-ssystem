import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import * as controller from "../controllers/admin/inventory-batch.controller";
import { startExpiryScanner } from "../shared/expiry-scanner";

startExpiryScanner();

export const inventoryBatchRouter = Router();

// ==================== 批次管理 ====================

inventoryBatchRouter.get("/batches", controller.listBatches);
inventoryBatchRouter.get("/batches/fifo-suggestion/:storeId/:skuId", controller.getFifoSuggestion);
inventoryBatchRouter.get("/batches/:id", controller.getBatchDetail);
inventoryBatchRouter.post("/batches", controller.createBatch);
inventoryBatchRouter.put("/batches/:id", controller.updateBatch);
inventoryBatchRouter.post("/batches/:id/split", controller.splitBatch);

// ==================== 批次追溯 ====================

inventoryBatchRouter.get("/batches/:id/trace", controller.getBatchTrace);
inventoryBatchRouter.get("/products/:spuId/batches", controller.getProductBatches);

// ==================== 效期预警配置 ====================

inventoryBatchRouter.get("/expiry-configs", controller.listExpiryConfigs);
inventoryBatchRouter.post("/expiry-configs", controller.createExpiryConfig);
inventoryBatchRouter.put("/expiry-configs/:id", controller.updateExpiryConfig);
inventoryBatchRouter.delete("/expiry-configs/:id", controller.deleteExpiryConfig);

// ==================== 效期预警记录 ====================

inventoryBatchRouter.get("/expiry-alerts", controller.listExpiryAlerts);
inventoryBatchRouter.get("/expiry-alerts/statistics", controller.getExpiryAlertStatistics);
inventoryBatchRouter.put("/expiry-alerts/:id/handle", controller.handleExpiryAlert);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/inventory-batch",
  router: inventoryBatchRouter,
  auth: "requireAuthWithTenant",
};
