import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as controller from "../controllers/admin/inventory-batch.controller.js";
import * as service from "../services/admin/inventory-batch.service.js";

export const inventoryBatchRouter = Router();

inventoryBatchRouter.use(requireAuthWithTenant);

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

// ==================== 效期扫描器 ====================

let expiryScannerRunning = false;

export function startExpiryScanner() {
  console.info("[效期扫描器] 已启动，每60秒检查一次（凌晨2点执行全量扫描）");

  const timer = setInterval(async () => {
    if (expiryScannerRunning) return;
    const now = new Date();
    const hour = now.getHours();
    if (hour !== 2) return;

    expiryScannerRunning = true;
    try {
      await service.runExpiryScan();
      console.info("[效期扫描器] 扫描完成");
    } catch (error) {
      console.error("[效期扫描器] 扫描失败:", error);
    } finally {
      expiryScannerRunning = false;
    }
  }, 60 * 1000);
  (timer as any).unref();
}