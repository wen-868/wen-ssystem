import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/store-control.controller.js";

// ==================== 管理端路由器（admin） ====================

export const adminStoreControlRouter = Router();

adminStoreControlRouter.use(requireAuthWithTenant);

adminStoreControlRouter.get("/configs", ctrl.listConfigs);
adminStoreControlRouter.get("/configs/:storeId", ctrl.getConfig);
adminStoreControlRouter.put("/configs/:storeId", ctrl.updateConfig);
adminStoreControlRouter.post("/:storeId/open", ctrl.openStore);
adminStoreControlRouter.post("/:storeId/close", ctrl.closeStore);
adminStoreControlRouter.post("/:storeId/suspend", ctrl.suspendStore);
adminStoreControlRouter.post("/:storeId/resume", ctrl.resumeStore);
adminStoreControlRouter.get("/logs", ctrl.listStatusLogs);

// ==================== 门店终端侧路由器（store，只读接口） ====================

export const storeStoreControlRouter = Router();

storeStoreControlRouter.get("/status", ctrl.getStoreStatus);
storeStoreControlRouter.get("/my-logs", ctrl.listMyLogs);

// ==================== 定时检查器 ====================

import { query, transaction } from "../shared/db.js";

let storeControlRunning = false;

export function startStoreControlScheduler() {
  console.info("[门店管控] 定时检查器已启动，每60秒检查一次");

  const timer = setInterval(async () => {
    if (storeControlRunning) return;
    storeControlRunning = true;
    try {
      await runStoreControlCheck();
    } catch (error) {
      console.error("[门店管控] 定时检查失败:", error);
    } finally {
      storeControlRunning = false;
    }
  }, 60 * 1000);
  (timer as any).unref();
}

async function runStoreControlCheck() {
  const tenantRows = await query<any>(
    "SELECT DISTINCT tenant_id FROM store_control_config"
  );
  const tenantIds = tenantRows.map((r: any) => r.tenant_id).filter(Boolean);

  if (tenantIds.length === 0) return;

  for (const tenantId of tenantIds) {
    const configs = await query<any>(
      `SELECT scc.*, s.status AS current_status, s.name AS store_name
       FROM store_control_config scc
       JOIN store s ON s.id = scc.store_id AND s.tenant_id = scc.tenant_id
       WHERE scc.tenant_id = ?
         AND s.status IN ('OPEN', 'CLOSED')`,
      [tenantId]
    );

    if (configs.length === 0) continue;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    await transaction(async (conn) => {
      for (const config of configs) {
        const currentStatus = config.current_status || "OPEN";

        if (config.auto_open_time && currentStatus === "CLOSED" && currentTime >= config.auto_open_time && currentTime < (config.auto_close_time || "23:59")) {
          await conn.execute(
            "UPDATE store SET status = 'OPEN' WHERE id = ? AND tenant_id = ? AND status = 'CLOSED'",
            [config.store_id, tenantId]
          );
          await conn.execute(
            `INSERT INTO store_status_log (tenant_id, store_id, from_status, to_status, change_type, operator_id, remark)
             VALUES (?, ?, 'CLOSED', 'OPEN', 'SCHEDULED', NULL, '定时自动开门')`,
            [tenantId, config.store_id]
          );
          console.info(`[门店管控] 租户 ${tenantId} 门店 ${config.store_name}(${config.store_id}) 自动开门`);
        }

        if (config.auto_close_time && currentStatus === "OPEN" && currentTime >= config.auto_close_time) {
          await conn.execute(
            "UPDATE store SET status = 'CLOSED' WHERE id = ? AND tenant_id = ? AND status = 'OPEN'",
            [config.store_id, tenantId]
          );
          await conn.execute(
            `INSERT INTO store_status_log (tenant_id, store_id, from_status, to_status, change_type, operator_id, remark)
             VALUES (?, ?, 'OPEN', 'CLOSED', 'SCHEDULED', NULL, '定时自动关门')`,
            [tenantId, config.store_id]
          );
          console.info(`[门店管控] 租户 ${tenantId} 门店 ${config.store_name}(${config.store_id}) 自动关门`);
        }

        if (config.max_daily_orders && currentStatus === "OPEN") {
          const [orderRows] = await conn.execute<any[]>(
            `SELECT COUNT(*) AS order_count FROM sale_bill
             WHERE store_id = ? AND tenant_id = ? AND DATE(created_at) = CURDATE() AND business_status NOT IN ('DRAFT', 'VOIDED')`,
            [config.store_id, tenantId]
          );
          const orderCount = (orderRows as any[])[0]?.order_count ?? 0;
          if (orderCount >= config.max_daily_orders) {
            await conn.execute(
              "UPDATE store SET status = 'CLOSED' WHERE id = ? AND tenant_id = ? AND status = 'OPEN'",
              [config.store_id, tenantId]
            );
            await conn.execute(
              `INSERT INTO store_status_log (tenant_id, store_id, from_status, to_status, change_type, operator_id, remark)
               VALUES (?, ?, 'OPEN', 'CLOSED', 'AUTO', NULL, ?)`,
              [tenantId, config.store_id, "当日订单数(" + orderCount + ")已达上限(" + config.max_daily_orders + ")，自动关门"]
            );
            console.info(`[门店管控] 租户 ${tenantId} 门店 ${config.store_name}(${config.store_id}) 订单数达上限，自动关门`);
          }
        }

        if (config.max_order_amount && currentStatus === "OPEN") {
          const [amountRows] = await conn.execute<any[]>(
            `SELECT COALESCE(SUM(receivable_amount), 0) AS total_amount FROM sale_bill
             WHERE store_id = ? AND tenant_id = ? AND DATE(created_at) = CURDATE() AND business_status NOT IN ('DRAFT', 'VOIDED')`,
            [config.store_id, tenantId]
          );
          const totalAmount = Number((amountRows as any[])[0]?.total_amount ?? 0);
          if (totalAmount >= config.max_order_amount) {
            await conn.execute(
              "UPDATE store SET status = 'CLOSED' WHERE id = ? AND tenant_id = ? AND status = 'OPEN'",
              [config.store_id, tenantId]
            );
            await conn.execute(
              `INSERT INTO store_status_log (tenant_id, store_id, from_status, to_status, change_type, operator_id, remark)
               VALUES (?, ?, 'OPEN', 'CLOSED', 'AUTO', NULL, ?)`,
              [tenantId, config.store_id, "当日订单金额(" + totalAmount.toFixed(2) + ")已达上限(" + config.max_order_amount + ")，自动关门"]
            );
            console.info(`[门店管控] 租户 ${tenantId} 门店 ${config.store_name}(${config.store_id}) 订单金额达上限，自动关门`);
          }
        }
      }
    });
  }
}