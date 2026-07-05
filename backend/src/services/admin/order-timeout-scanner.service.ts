import { query, transaction } from "../../shared/db.js";
import logger from "../../shared/logger.js";

let scannerRunning = false;

/** 执行单个超时配置的扫描和处理 */
async function processTimeoutConfig(config: {
  id: number;
  order_type: string;
  timeout_type: string;
  timeout_minutes: number;
  action: string;
  tenant_id: number;
}) {
  const tenantId = config.tenant_id;
  let tableName = "";
  let statusField = "";
  let statusValue = "";
  let extraWhere = "";

  if (config.order_type === "SALE") {
    tableName = "miniapp_order";
    if (config.timeout_type === "WAIT_PAY") {
      statusField = "pay_status";
      statusValue = "UNPAID";
      extraWhere = "AND order_status = 'PENDING'";
    } else if (config.timeout_type === "WAIT_ACCEPT") {
      statusField = "order_status";
      statusValue = "PENDING";
    } else if (config.timeout_type === "WAIT_SIGN") {
      statusField = "delivery_status";
      statusValue = "PENDING_DELIVERY";
    }
  } else if (config.order_type === "PURCHASE") {
    tableName = "purchase_order";
    if (config.timeout_type === "WAIT_CONFIRM") {
      statusField = "status";
      statusValue = "PENDING";
    }
  }

  if (!tableName || !statusField) return;

  const orders = await query<{ id: number; order_no: string }>(
    `SELECT id, order_no
     FROM ${tableName}
     WHERE ${statusField} = ?
       ${extraWhere}
       AND tenant_id = ?
       AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
       AND id NOT IN (
         SELECT order_id FROM order_timeout_log
         WHERE timeout_type = ? AND result = 'SUCCESS' AND tenant_id = ?
       )
     LIMIT 100`,
    [statusValue, tenantId, config.timeout_minutes, config.timeout_type, tenantId]
  );

  for (const order of orders) {
    try {
      await transaction(async (conn) => {
        if (config.action === "CANCEL") {
          if (config.timeout_type === "WAIT_PAY") {
            await conn.execute(
              `UPDATE ${tableName} SET order_status = 'CANCELLED', pay_status = 'CANCELLED', updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
              [order.id, tenantId]
            );
          } else if (config.timeout_type === "WAIT_SIGN") {
            await conn.execute(
              `UPDATE ${tableName} SET order_status = 'COMPLETED', updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
              [order.id, tenantId]
            );
          } else {
            await conn.execute(
              `UPDATE ${tableName} SET order_status = 'CANCELLED', updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
              [order.id, tenantId]
            );
          }
        } else if (config.action === "AUTO_ACCEPT") {
          await conn.execute(
            `UPDATE ${tableName} SET order_status = 'ACCEPTED', updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
            [order.id, tenantId]
          );
        } else if (config.action === "AUTO_SIGN") {
          await conn.execute(
            `UPDATE ${tableName} SET delivery_status = 'DELIVERED', order_status = 'COMPLETED', updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
            [order.id, tenantId]
          );
        }

        await conn.execute(
          `INSERT INTO order_timeout_log (order_id, order_type, timeout_type, action_taken, triggered_at, handled_at, result, remark, tenant_id)
           VALUES (?, ?, ?, ?, NOW(), NOW(), 'SUCCESS', ?, ?)`,
          [order.id, config.order_type, config.timeout_type, config.action, `订单${order.order_no}超时自动${config.action}`, tenantId]
        );
      });
    } catch (err) {
      try {
        await query(
          `INSERT INTO order_timeout_log (order_id, order_type, timeout_type, action_taken, triggered_at, handled_at, result, remark, tenant_id)
           VALUES (?, ?, ?, ?, NOW(), NOW(), 'FAILED', ?, ?)`,
          [order.id, config.order_type, config.timeout_type, config.action, String(err), tenantId]
        );
      } catch {
        logger.error(`订单超时处理失败 [订单ID=${order.id} 租户ID=${tenantId}]:`, err);
      }
    }
  }
}

/** 启动订单超时定时扫描器 */
export function startOrderTimeoutScanner() {
  if (scannerRunning) return;
  scannerRunning = true;

  const SCAN_INTERVAL = 60_000;

  const timer = setInterval(async () => {
    try {
      const configs = await query<{
        id: number;
        order_type: string;
        timeout_type: string;
        timeout_minutes: number;
        action: string;
        tenant_id: number;
      }>(
        "SELECT id, order_type, timeout_type, timeout_minutes, action, tenant_id FROM order_timeout_config WHERE enabled = 1"
      );

      for (const config of configs) {
        await processTimeoutConfig(config);
      }
    } catch (err) {
      logger.error("[OrderTimeoutScanner] 扫描出错:", err);
    }
  }, SCAN_INTERVAL);

  if (typeof (timer as unknown as NodeJS.Timeout).unref === "function") {
    (timer as unknown as NodeJS.Timeout).unref();
  }

  logger.info("[OrderTimeoutScanner] 订单超时扫描器已启动，每60秒扫描一次");
}