import { query, transaction, queryWithTenant, queryOneWithTenant } from "../../shared/db";
import type { PoolConnection } from "mysql2/promise";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import logger from "../../shared/logger";
import { appendOrderProgressEvent, miniappRetailEvent } from "../../shared/order-progress-events";

/** 超时扫描命中行 */
interface TimeoutOrderRow extends RowDataPacket {
  id: number;
  order_no: string;
}

/**
 * 支付超时取消事件（miniapp_retail · 契约 §7.1 PAYMENT_TIMEOUT）。
 *
 * - 与状态 UPDATE / SUCCESS 超时日志同事务（调用方 conn）⇒ 事件写失败整单回滚；
 * - 仅 miniapp_retail（customer_type=RETAIL）写事件，采购/批发单不外扩（红线 §七）；
 * - business_stage=CANCELLED（终态，装配器补 ended_at），business_status 取事务内真实主表值；
 * - failure_code=PAYMENT_TIMEOUT 必带 retry_entry（§7.1：重试入口=前端重新创建订单）；
 * - upstreamBizKey=orderNo:TIMEOUT:WAIT_PAY ⇒ 重复扫描/重放按 source_event_id 幂等（只留一行）。
 */
async function appendPaymentTimeoutEvent(
  conn: PoolConnection,
  order: TimeoutOrderRow,
  tenantId: string,
): Promise<void> {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT store_id, customer_type, order_status FROM t_miniapp_order WHERE id = ? AND tenant_id = ? LIMIT 1`,
    [order.id, tenantId]
  );
  const o = rows[0] as unknown as { store_id: number | string; customer_type: string; order_status: string } | undefined;
  if (!o || o.customer_type !== "RETAIL") return;

  await appendOrderProgressEvent(conn, miniappRetailEvent({
    tenantId,
    storeId: o.store_id,
    orderNo: order.order_no,
    businessStage: "CANCELLED",
    businessStatus: o.order_status,
    actorType: "cron",
    actorId: null,
    upstreamBizKey: `${order.order_no}:TIMEOUT:WAIT_PAY`,
    failureCode: "PAYMENT_TIMEOUT",
    retryEntry: "miniapp:/orders/create-again",
    statusReason: "支付超时，订单已自动取消",
    at: new Date(),
    actorFallback: "order-timeout-wait-pay",
  }));
}

/** t_order_timeout_config 配置行（带别名） */
interface OrderTimeoutConfigRow {
  id: number | string;
  orderType: string;
  timeoutType: string;
  timeoutMinutes: number | string;
  action: string;
  enabled: number | string;
  description: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** t_order_timeout_log 日志行（带别名） */
interface OrderTimeoutLogRow {
  id: number | string;
  orderId: number | string;
  orderType: string;
  timeoutType: string;
  actionTaken: string;
  triggeredAt: string | Date;
  handledAt: string | Date | null;
  result: string;
  remark: string | null;
  createdAt: string | Date;
}

export async function getConfigs(tenantId: string) {
  return queryWithTenant<OrderTimeoutConfigRow>(
    "SELECT id, order_type AS orderType, timeout_type AS timeoutType, timeout_minutes AS timeoutMinutes, action, enabled, description, created_at AS createdAt, updated_at AS updatedAt FROM t_order_timeout_config ORDER BY id ASC",
    [],
    tenantId
  );
}

export async function createConfig(tenantId: string, body: {
  orderType: string;
  timeoutType: string;
  timeoutMinutes: number;
  action: string;
  enabled: boolean;
  description?: string;
}) {
  const result = await queryWithTenant<{ insertId: number }>(
    "INSERT INTO t_order_timeout_config (order_type, timeout_type, timeout_minutes, action, enabled, description) VALUES (?, ?, ?, ?, ?, ?)",
    [body.orderType, body.timeoutType, body.timeoutMinutes, body.action, body.enabled ? 1 : 0, body.description || null],
    tenantId
  );
  return { id: (result as unknown as unknown as { insertId: number }).insertId };
}

export async function updateConfig(tenantId: string, id: number, body: {
  orderType?: string;
  timeoutType?: string;
  timeoutMinutes?: number;
  action?: string;
  enabled?: boolean;
  description?: string;
}) {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.orderType !== undefined) { fields.push("order_type = ?"); values.push(body.orderType); }
  if (body.timeoutType !== undefined) { fields.push("timeout_type = ?"); values.push(body.timeoutType); }
  if (body.timeoutMinutes !== undefined) { fields.push("timeout_minutes = ?"); values.push(body.timeoutMinutes); }
  if (body.action !== undefined) { fields.push("action = ?"); values.push(body.action); }
  if (body.enabled !== undefined) { fields.push("enabled = ?"); values.push(body.enabled ? 1 : 0); }
  if (body.description !== undefined) { fields.push("description = ?"); values.push(body.description); }

  if (fields.length === 0) return false;

  values.push(id);
  await queryWithTenant(`UPDATE t_order_timeout_config SET ${fields.join(", ")} WHERE id = ?`, values, tenantId);
  return true;
}

export async function deleteConfig(tenantId: string, id: number) {
  await queryWithTenant("DELETE FROM t_order_timeout_config WHERE id = ?", [id], tenantId);
}

export async function getLogs(tenantId: string, params: {
  page: number;
  pageSize: number;
  result: string;
  dateStart: string;
  dateEnd: string;
}) {
  const { page, pageSize, result, dateStart, dateEnd } = params;
  const offset = (page - 1) * pageSize;

  const whereClauses: string[] = [];
  const sqlParams: unknown[] = [];

  if (result) {
    whereClauses.push("otl.result = ?");
    sqlParams.push(result);
  }
  if (dateStart) {
    whereClauses.push("otl.triggered_at >= ?");
    sqlParams.push(dateStart);
  }
  if (dateEnd) {
    whereClauses.push("otl.triggered_at <= ?");
    sqlParams.push(dateEnd + " 23:59:59");
  }

  const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

  const totalRow = await queryOneWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_order_timeout_log otl ${whereSql}`,
    sqlParams,
    tenantId
  );

  const records = await queryWithTenant<OrderTimeoutLogRow>(
    `SELECT otl.id, otl.order_id AS orderId, otl.order_type AS orderType, otl.timeout_type AS timeoutType,
            otl.action_taken AS actionTaken, otl.triggered_at AS triggeredAt, otl.handled_at AS handledAt,
            otl.result, otl.remark, otl.created_at AS createdAt
     FROM t_order_timeout_log otl
     ${whereSql}
     ORDER BY otl.id DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, pageSize, offset],
    tenantId
  );

  return {
    total: totalRow?.total ?? 0,
    page,
    pageSize,
    records,
  };
}

export async function getStatistics(tenantId: string) {
  const todayStats = await queryOneWithTenant<{ count: number }>(
    "SELECT COUNT(*) AS count FROM t_order_timeout_log WHERE DATE(triggered_at) = CURDATE()",
    [],
    tenantId
  );
  const weekStats = await queryOneWithTenant<{ count: number }>(
    "SELECT COUNT(*) AS count FROM t_order_timeout_log WHERE YEARWEEK(triggered_at, 1) = YEARWEEK(CURDATE(), 1)",
    [],
    tenantId
  );
  const monthStats = await queryOneWithTenant<{ count: number }>(
    "SELECT COUNT(*) AS count FROM t_order_timeout_log WHERE DATE_FORMAT(triggered_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')",
    [],
    tenantId
  );
  const successStats = await queryOneWithTenant<{ count: number }>(
    "SELECT COUNT(*) AS count FROM t_order_timeout_log WHERE result = 'SUCCESS' AND DATE(triggered_at) = CURDATE()",
    [],
    tenantId
  );
  const failedStats = await queryOneWithTenant<{ count: number }>(
    "SELECT COUNT(*) AS count FROM t_order_timeout_log WHERE result = 'FAILED' AND DATE(triggered_at) = CURDATE()",
    [],
    tenantId
  );

  return {
    today: todayStats?.count ?? 0,
    thisWeek: weekStats?.count ?? 0,
    thisMonth: monthStats?.count ?? 0,
    todaySuccess: successStats?.count ?? 0,
    todayFailed: failedStats?.count ?? 0,
  };
}

export async function getEnabledConfigs() {
  return query<{
    id: number;
    order_type: string;
    timeout_type: string;
    timeout_minutes: number;
    action: string;
    tenant_id: number;
  }>(
    "SELECT id, order_type, timeout_type, timeout_minutes, action, tenant_id FROM t_order_timeout_config WHERE enabled = 1"
  );
}

export async function processTimeoutConfig(config: {
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
    // 修正：真实表名是 t_miniapp_order（原写 miniapp_order ⇒ 该表不存在，SALE 分支整体扫不到任何单）。
    // 卡 §五·一.1 授权本卡修复 WAIT_PAY 筛选，使 miniapp_retail 族可真实命中。
    tableName = "t_miniapp_order";
    if (config.timeout_type === "WAIT_PAY") {
      // 修正：小程序零售真实待支付状态是 order_status='PENDING_PAYMENT' + pay_status='UNPAID'
      //（原写 order_status='PENDING' ⇒ 与 t_miniapp_order 值域不符，本族零命中）
      statusField = "pay_status";
      statusValue = "UNPAID";
      extraWhere = "AND order_status = 'PENDING_PAYMENT'";
    } else if (config.timeout_type === "WAIT_ACCEPT") {
      statusField = "order_status";
      statusValue = "PENDING";
    } else if (config.timeout_type === "WAIT_SIGN") {
      statusField = "delivery_status";
      statusValue = "PENDING_DELIVERY";
    }
  } else if (config.order_type === "PURCHASE") {
    // 采购单属其他订单族 ⇒ 本卡红线不外扩，保持现网原样（表名/口径不在本卡改动范围）
    tableName = "purchase_order";
    if (config.timeout_type === "WAIT_CONFIRM") {
      statusField = "status";
      statusValue = "PENDING";
    }
  }

  if (!tableName || !statusField) {
    return;
  }

  const orders = await query<TimeoutOrderRow>(
    `SELECT id, order_no
     FROM ${tableName}
     WHERE ${statusField} = ?
       ${extraWhere}
       AND tenant_id = ?
       AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
       AND id NOT IN (
         SELECT order_id FROM t_order_timeout_log
         WHERE timeout_type = ? AND result = 'SUCCESS' AND tenant_id = ?
       )
     LIMIT 100`,
    [statusValue, tenantId, config.timeout_minutes, config.timeout_type, tenantId]
  );

  for (const order of orders) {
    try {
      await transaction(async (conn) => {
        // WAIT_PAY 超时取消：UPDATE 带并发守卫（扫描后用户恰好支付成功 ⇒ 不得误取消，
        // 卡 §五·一.1）。仅 affectedRows=1 才写 SUCCESS 日志与 PAYMENT_TIMEOUT 事件。
        let guardedCancel = false;

        if (config.action === "CANCEL") {
          if (config.timeout_type === "WAIT_PAY") {
            const [res] = await conn.execute<ResultSetHeader>(
              `UPDATE ${tableName} SET order_status = 'CANCELLED', pay_status = 'CANCELLED', updated_at = NOW()
               WHERE id = ? AND tenant_id = ?
                 AND order_status = 'PENDING_PAYMENT' AND pay_status = 'UNPAID'`,
              [order.id, tenantId]
            );
            if (Number(res?.affectedRows ?? 0) !== 1) {
              // 并发下已被支付/已取消 ⇒ 不写 SUCCESS 日志、不写超时事件（防误取消假成功）
              return;
            }
            guardedCancel = true;
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
          `INSERT INTO t_order_timeout_log (order_id, order_type, timeout_type, action_taken, triggered_at, handled_at, result, remark, tenant_id)
           VALUES (?, ?, ?, ?, NOW(), NOW(), 'SUCCESS', ?, ?)`,
          [order.id, config.order_type, config.timeout_type, config.action, `订单${order.order_no}超时自动${config.action}`, tenantId]
        );

        // 契约 §8.1 + §五.5：支付超时取消 ⇒ 同事务写 CANCELLED 事件 + 九码 PAYMENT_TIMEOUT
        //（§7.1 PAYMENT_TIMEOUT needRetryEntry=true ⇒ 必须携带 retry_entry，否则校验器判红）
        if (guardedCancel) {
          await appendPaymentTimeoutEvent(conn, order, String(tenantId));
        }
      });
    } catch (err) {
      try {
        await query(
          `INSERT INTO t_order_timeout_log (order_id, order_type, timeout_type, action_taken, triggered_at, handled_at, result, remark, tenant_id)
           VALUES (?, ?, ?, ?, NOW(), NOW(), 'FAILED', ?, ?)`,
          [order.id, config.order_type, config.timeout_type, config.action, String(err), tenantId]
        );
      } catch {
        logger.error(`订单超时处理失败 [订单ID=${order.id} 租户ID=${tenantId}]:`, err);
      }
    }
  }
}

let scannerRunning = false;

export function startOrderTimeoutScanner() {
  if (scannerRunning) return;
  scannerRunning = true;

  const SCAN_INTERVAL = 60_000;

  const timer = setInterval(async () => {
    try {
      const configs = await getEnabledConfigs();

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