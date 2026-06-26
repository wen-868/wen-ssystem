import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/inventory-batch.controller.js";

export const inventoryBatchRouter = Router();

inventoryBatchRouter.use(requireAuthWithTenant);

// ==================== 批次管理 ====================

inventoryBatchRouter.get("/batches", ctrl.listBatches);
inventoryBatchRouter.get("/batches/fifo-suggestion/:storeId/:skuId", ctrl.getFifoSuggestion);
inventoryBatchRouter.get("/batches/:id", ctrl.getBatchDetail);
inventoryBatchRouter.post("/batches", ctrl.createBatch);
inventoryBatchRouter.put("/batches/:id", ctrl.updateBatch);
inventoryBatchRouter.post("/batches/:id/split", ctrl.splitBatch);

// ==================== 效期预警配置 ====================

inventoryBatchRouter.get("/expiry-configs", ctrl.listExpiryConfigs);
inventoryBatchRouter.post("/expiry-configs", ctrl.createExpiryConfig);
inventoryBatchRouter.put("/expiry-configs/:id", ctrl.updateExpiryConfig);
inventoryBatchRouter.delete("/expiry-configs/:id", ctrl.deleteExpiryConfig);

// ==================== 效期预警记录 ====================

inventoryBatchRouter.get("/expiry-alerts/statistics", ctrl.getExpiryAlertStatistics);
inventoryBatchRouter.get("/expiry-alerts", ctrl.listExpiryAlerts);
inventoryBatchRouter.put("/expiry-alerts/:id/handle", ctrl.handleExpiryAlert);

// ==================== 效期扫描器 ====================

import { query, transaction } from "../shared/db.js";

let expiryScannerRunning = false;

export function startExpiryScanner() {
  console.log("[效期扫描器] 已启动，每60秒检查一次（凌晨2点执行全量扫描）");

  const timer = setInterval(async () => {
    if (expiryScannerRunning) return;
    const now = new Date();
    const hour = now.getHours();
    // 每天凌晨2点执行全量扫描
    if (hour !== 2) return;

    expiryScannerRunning = true;
    try {
      await runExpiryScan();
      console.log("[效期扫描器] 扫描完成");
    } catch (error) {
      console.error("[效期扫描器] 扫描失败:", error);
    } finally {
      expiryScannerRunning = false;
    }
  }, 60 * 1000);
  timer.unref();
}

async function runExpiryScan() {
  const tenantRows = await query<any>(
    "SELECT DISTINCT tenant_id FROM inventory_batch WHERE expiry_date IS NOT NULL"
  );
  const tenantIds = tenantRows.map((r: any) => r.tenant_id).filter(Boolean);

  if (tenantIds.length === 0) return;

  for (const tenantId of tenantIds) {
    const configs = await query<any>(
      "SELECT * FROM expiry_alert_config WHERE tenant_id = ? AND enabled = 1 ORDER BY days_before_expiry DESC",
      [tenantId]
    );
    if (configs.length === 0) continue;

    const batches = await query<any>(
      `SELECT ib.*, ps.sku_name
       FROM inventory_batch ib
       LEFT JOIN product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
       WHERE ib.tenant_id = ?
         AND ib.expiry_date IS NOT NULL
         AND ib.quantity > 0`,
      [tenantId]
    );

    if (batches.length === 0) continue;

    await transaction(async (conn) => {
      for (const batch of batches) {
        const [rows] = await conn.execute<any[]>(
          "SELECT DATEDIFF(?, CURDATE()) AS days_remaining",
          [batch.expiry_date]
        );
        const daysRemaining = (rows as any[])[0]?.days_remaining ?? 0;

        let matchedConfig: any = null;
        for (const config of configs) {
          if (daysRemaining <= config.days_before_expiry && daysRemaining >= 0) {
            matchedConfig = config;
            break;
          }
        }

        if (daysRemaining < 0) {
          await conn.execute(
            "UPDATE expiry_alert_record SET status = 'EXPIRED' WHERE batch_id = ? AND tenant_id = ? AND status = 'PENDING'",
            [batch.id, tenantId]
          );
          continue;
        }

        if (!matchedConfig) continue;

        const [existing] = await conn.execute<any[]>(
          "SELECT id FROM expiry_alert_record WHERE batch_id = ? AND tenant_id = ? AND alert_level = ? AND status = 'PENDING'",
          [batch.id, tenantId, matchedConfig.alert_level]
        );

        if ((existing as any[]).length > 0) {
          await conn.execute(
            "UPDATE expiry_alert_record SET days_remaining = ? WHERE batch_id = ? AND tenant_id = ? AND alert_level = ? AND status = 'PENDING'",
            [daysRemaining, batch.id, tenantId, matchedConfig.alert_level]
          );
          continue;
        }

        await conn.execute(
          `INSERT INTO expiry_alert_record (tenant_id, batch_id, store_id, sku_id, sku_name, batch_no, production_date, expiry_date, days_remaining, alert_level, action_taken, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
          [tenantId, batch.id, batch.store_id, batch.sku_id, batch.sku_name || "", batch.batch_no, batch.production_date, batch.expiry_date, daysRemaining, matchedConfig.alert_level, matchedConfig.action]
        );

        if (matchedConfig.action === "BLOCK") {
          await conn.execute(
            "UPDATE inventory_batch SET locked_quantity = quantity WHERE id = ? AND tenant_id = ? AND locked_quantity < quantity",
            [batch.id, tenantId]
          );
        }
      }
    });
  }
}