import { query, queryOne, transaction } from "../../shared/db.js";
import logger from "../../shared/logger.js";

export async function getConfigs(tenantId: string) {
  return query<any>(
    "SELECT id, order_type AS orderType, timeout_type AS timeoutType, timeout_minutes AS timeoutMinutes, action, enabled, description, created_at AS createdAt, updated_at AS updatedAt FROM order_timeout_config WHERE tenant_id = ? ORDER BY id ASC",
    [tenantId]
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
  const result = await query<{ insertId: number }>(
    "INSERT INTO order_timeout_config (order_type, timeout_type, timeout_minutes, action, enabled, description, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [body.orderType, body.timeoutType, body.timeoutMinutes, body.action, body.enabled ? 1 : 0, body.description || null, tenantId]
  );
  return { id: (result as any).insertId };
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

  values.push(id, tenantId);
  await query(`UPDATE order_timeout_config SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values);
  return true;
}

export async function deleteConfig(tenantId: string, id: number) {
  await query("DELETE FROM order_timeout_config WHERE id = ? AND tenant_id = ?", [id, tenantId]);
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

  const whereClauses: string[] = ["otl.tenant_id = ?"];
  const sqlParams: unknown[] = [tenantId];

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

  const whereSql = "WHERE " + whereClauses.join(" AND ");

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM order_timeout_log otl ${whereSql}`,
    sqlParams
  );

  const records = await query<any>(
    `SELECT otl.id, otl.order_id AS orderId, otl.order_type AS orderType, otl.timeout_type AS timeoutType,
            otl.action_taken AS actionTaken, otl.triggered_at AS triggeredAt, otl.handled_at AS handledAt,
            otl.result, otl.remark, otl.created_at AS createdAt
     FROM order_timeout_log otl
     ${whereSql}
     ORDER BY otl.id DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, pageSize, offset]
  );

  return {
    total: totalRow?.total ?? 0,
    page,
    pageSize,
    records,
  };
}

export async function getStatistics(tenantId: string) {
  const todayStats = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM order_timeout_log WHERE tenant_id = ? AND DATE(triggered_at) = CURDATE()",
    [tenantId]
  );
  const weekStats = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM order_timeout_log WHERE tenant_id = ? AND YEARWEEK(triggered_at, 1) = YEARWEEK(CURDATE(), 1)",
    [tenantId]
  );
  const monthStats = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM order_timeout_log WHERE tenant_id = ? AND DATE_FORMAT(triggered_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')",
    [tenantId]
  );
  const successStats = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM order_timeout_log WHERE tenant_id = ? AND result = 'SUCCESS' AND DATE(triggered_at) = CURDATE()",
    [tenantId]
  );
  const failedStats = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM order_timeout_log WHERE tenant_id = ? AND result = 'FAILED' AND DATE(triggered_at) = CURDATE()",
    [tenantId]
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
    "SELECT id, order_type, timeout_type, timeout_minutes, action, tenant_id FROM order_timeout_config WHERE enabled = 1"
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

  if (!tableName || !statusField) {
    return;
  }

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