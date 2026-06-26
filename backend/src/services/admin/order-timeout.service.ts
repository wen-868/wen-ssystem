import { query, queryOne } from "../../shared/db.js";

export async function listConfigs(tenantId: string) {
  const configs = await query<any>(
    "SELECT id, order_type AS orderType, timeout_type AS timeoutType, timeout_minutes AS timeoutMinutes, action, enabled, description, created_at AS createdAt, updated_at AS updatedAt FROM order_timeout_config WHERE tenant_id = ? ORDER BY id ASC",
    [tenantId]
  );
  return configs;
}

export async function createConfig(body: {
  orderType: string;
  timeoutType: string;
  timeoutMinutes: number;
  action: string;
  enabled?: boolean;
  description?: string;
}, tenantId: string) {
  const result = await query<{ insertId: number }>(
    "INSERT INTO order_timeout_config (order_type, timeout_type, timeout_minutes, action, enabled, description, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [body.orderType, body.timeoutType, body.timeoutMinutes, body.action, body.enabled !== false ? 1 : 0, body.description || null, tenantId]
  );
  return { id: (result as any).insertId };
}

export async function updateConfig(id: number, body: {
  orderType?: string;
  timeoutType?: string;
  timeoutMinutes?: number;
  action?: string;
  enabled?: boolean;
  description?: string;
}, tenantId: string) {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.orderType !== undefined) { fields.push("order_type = ?"); values.push(body.orderType); }
  if (body.timeoutType !== undefined) { fields.push("timeout_type = ?"); values.push(body.timeoutType); }
  if (body.timeoutMinutes !== undefined) { fields.push("timeout_minutes = ?"); values.push(body.timeoutMinutes); }
  if (body.action !== undefined) { fields.push("action = ?"); values.push(body.action); }
  if (body.enabled !== undefined) { fields.push("enabled = ?"); values.push(body.enabled ? 1 : 0); }
  if (body.description !== undefined) { fields.push("description = ?"); values.push(body.description); }

  if (fields.length === 0) {
    return { message: "没有需要更新的字段" };
  }

  values.push(id, tenantId);
  await query(`UPDATE order_timeout_config SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values);

  return { message: "更新成功" };
}

export async function deleteConfig(id: number, tenantId: string) {
  await query("DELETE FROM order_timeout_config WHERE id = ? AND tenant_id = ?", [id, tenantId]);
}

export async function listLogs(params: {
  page: number;
  pageSize: number;
  tenantId: string;
  result?: string;
  dateStart?: string;
  dateEnd?: string;
}) {
  const { page, pageSize, tenantId, result, dateStart, dateEnd } = params;
  const offset = (page - 1) * pageSize;

  const whereClauses: string[] = ["otl.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (result) {
    whereClauses.push("otl.result = ?");
    queryParams.push(result);
  }
  if (dateStart) {
    whereClauses.push("otl.triggered_at >= ?");
    queryParams.push(dateStart);
  }
  if (dateEnd) {
    whereClauses.push("otl.triggered_at <= ?");
    queryParams.push(dateEnd + " 23:59:59");
  }

  const whereSql = "WHERE " + whereClauses.join(" AND ");

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM order_timeout_log otl ${whereSql}`,
    queryParams
  );

  const records = await query<any>(
    `SELECT otl.id, otl.order_id AS orderId, otl.order_type AS orderType, otl.timeout_type AS timeoutType,
            otl.action_taken AS actionTaken, otl.triggered_at AS triggeredAt, otl.handled_at AS handledAt,
            otl.result, otl.remark, otl.created_at AS createdAt
     FROM order_timeout_log otl
     ${whereSql}
     ORDER BY otl.id DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
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