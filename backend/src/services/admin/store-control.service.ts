import { query, queryOne, transaction } from "../../shared/db.js";

// ==================== Admin 管控配置 ====================

export async function listConfigs(tenantId: string) {
  return query<any>(
    `SELECT scc.*, s.name AS store_name, s.status AS store_status
     FROM store_control_config scc
     LEFT JOIN store s ON s.id = scc.store_id AND s.tenant_id = scc.tenant_id
     WHERE scc.tenant_id = ?
     ORDER BY scc.id ASC`,
    [tenantId]
  );
}

export async function getConfig(storeId: number, tenantId: string) {
  return queryOne<any>(
    `SELECT scc.*, s.name AS store_name, s.status AS store_status
     FROM store_control_config scc
     LEFT JOIN store s ON s.id = scc.store_id AND s.tenant_id = scc.tenant_id
     WHERE scc.store_id = ? AND scc.tenant_id = ?`,
    [storeId, tenantId]
  );
}

export interface UpdateConfigBody {
  autoOpenTime?: string | null;
  autoCloseTime?: string | null;
  maxDailyOrders?: number | null;
  maxOrderAmount?: number | null;
}

export async function updateConfig(storeId: number, body: UpdateConfigBody, tenantId: string) {
  await transaction(async (conn) => {
    const [existing] = await conn.execute<any[]>(
      "SELECT id FROM store_control_config WHERE store_id = ? AND tenant_id = ?",
      [storeId, tenantId]
    );

    if ((existing as any[]).length > 0) {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (body.autoOpenTime !== undefined) { sets.push("auto_open_time = ?"); values.push(body.autoOpenTime); }
      if (body.autoCloseTime !== undefined) { sets.push("auto_close_time = ?"); values.push(body.autoCloseTime); }
      if (body.maxDailyOrders !== undefined) { sets.push("max_daily_orders = ?"); values.push(body.maxDailyOrders); }
      if (body.maxOrderAmount !== undefined) { sets.push("max_order_amount = ?"); values.push(body.maxOrderAmount); }
      if (sets.length > 0) {
        values.push(storeId, tenantId);
        await conn.execute(`UPDATE store_control_config SET ${sets.join(", ")} WHERE store_id = ? AND tenant_id = ?`, values as any[]);
      }
    } else {
      await conn.execute(
        `INSERT INTO store_control_config (store_id, auto_open_time, auto_close_time, max_daily_orders, max_order_amount, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [storeId, body.autoOpenTime ?? null, body.autoCloseTime ?? null, body.maxDailyOrders ?? null, body.maxOrderAmount ?? null, tenantId] as any[]
      );
    }
  });

  return { storeId };
}

// ==================== Admin 门店操作 ====================

export async function openStore(storeId: number, tenantId: string, userId: number) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT status FROM store WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [storeId, tenantId]
    );
    const store = (rows as any[])[0];
    if (!store) throw new Error("门店不存在");

    const fromStatus = store.status || "CLOSED";
    await conn.execute(
      "UPDATE store SET status = 'OPEN' WHERE id = ? AND tenant_id = ?",
      [storeId, tenantId] as any[]
    );
    await conn.execute(
      `INSERT INTO store_status_log (store_id, from_status, to_status, change_type, operator_id, remark, tenant_id)
       VALUES (?, ?, 'OPEN', 'MANUAL', ?, '手动开门', ?)`,
      [storeId, fromStatus, userId, tenantId] as any[]
    );
  });

  return { storeId, status: "OPEN" };
}

export async function closeStore(storeId: number, tenantId: string, userId: number) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT status FROM store WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [storeId, tenantId]
    );
    const store = (rows as any[])[0];
    if (!store) throw new Error("门店不存在");

    const fromStatus = store.status || "OPEN";
    await conn.execute(
      "UPDATE store SET status = 'CLOSED' WHERE id = ? AND tenant_id = ?",
      [storeId, tenantId] as any[]
    );
    await conn.execute(
      `INSERT INTO store_status_log (store_id, from_status, to_status, change_type, operator_id, remark, tenant_id)
       VALUES (?, ?, 'CLOSED', 'MANUAL', ?, '手动关门', ?)`,
      [storeId, fromStatus, userId, tenantId] as any[]
    );
  });

  return { storeId, status: "CLOSED" };
}

export async function suspendStore(storeId: number, tenantId: string, userId: number, reason?: string) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT status FROM store WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [storeId, tenantId]
    );
    const store = (rows as any[])[0];
    if (!store) throw new Error("门店不存在");

    const fromStatus = store.status || "OPEN";
    await conn.execute(
      "UPDATE store SET status = 'SUSPENDED' WHERE id = ? AND tenant_id = ?",
      [storeId, tenantId] as any[]
    );
    await conn.execute(
      `INSERT INTO store_status_log (store_id, from_status, to_status, change_type, operator_id, remark, tenant_id)
       VALUES (?, ?, 'SUSPENDED', 'MANUAL', ?, ?, ?)`,
      [storeId, fromStatus, userId, reason || "手动暂停营业", tenantId] as any[]
    );
    await conn.execute(
      `INSERT INTO store_control_config (store_id, suspended_reason, tenant_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE suspended_reason = ?`,
      [storeId, reason || "手动暂停营业", tenantId, reason || "手动暂停营业"] as any[]
    );
  });

  return { storeId, status: "SUSPENDED" };
}

export async function resumeStore(storeId: number, tenantId: string, userId: number) {
  await transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT status FROM store WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [storeId, tenantId]
    );
    const store = (rows as any[])[0];
    if (!store) throw new Error("门店不存在");

    const fromStatus = store.status || "SUSPENDED";
    await conn.execute(
      "UPDATE store SET status = 'OPEN' WHERE id = ? AND tenant_id = ?",
      [storeId, tenantId] as any[]
    );
    await conn.execute(
      `INSERT INTO store_status_log (store_id, from_status, to_status, change_type, operator_id, remark, tenant_id)
       VALUES (?, ?, 'OPEN', 'MANUAL', ?, '恢复营业', ?)`,
      [storeId, fromStatus, userId, tenantId] as any[]
    );
    await conn.execute(
      "UPDATE store_control_config SET suspended_reason = NULL WHERE store_id = ? AND tenant_id = ?",
      [storeId, tenantId] as any[]
    );
  });

  return { storeId, status: "OPEN" };
}

// ==================== Admin 状态日志 ====================

export interface ListStatusLogsParams {
  page: number;
  pageSize: number;
  tenantId: string;
  storeId?: number;
  changeType?: "MANUAL" | "SCHEDULED" | "AUTO";
}

export async function listStatusLogs(params: ListStatusLogsParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["ssl.tenant_id = ?"];
  const values: unknown[] = [params.tenantId];

  if (params.storeId) {
    conditions.push("ssl.store_id = ?");
    values.push(params.storeId);
  }
  if (params.changeType) {
    conditions.push("ssl.change_type = ?");
    values.push(params.changeType);
  }

  const where = conditions.join(" AND ");

  const records = await query<any>(
    `SELECT ssl.*, s.name AS store_name
     FROM store_status_log ssl
     LEFT JOIN store s ON s.id = ssl.store_id AND s.tenant_id = ssl.tenant_id
     WHERE ${where}
     ORDER BY ssl.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, params.pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM store_status_log ssl WHERE ${where}`,
    values
  );

  return { total: totalRow?.total ?? 0, page: params.page, pageSize: params.pageSize, records };
}

// ==================== Store 门店端 ====================

export async function getStoreStatus(storeId: number, tenantId: string) {
  const store = await queryOne<any>(
    "SELECT id, name, status FROM store WHERE id = ? AND tenant_id = ?",
    [storeId, tenantId]
  );

  const config = await queryOne<any>(
    "SELECT * FROM store_control_config WHERE store_id = ? AND tenant_id = ?",
    [storeId, tenantId]
  );

  return {
    storeId,
    storeName: store?.name || "",
    status: store?.status || "OPEN",
    config: config || null
  };
}

export interface ListMyLogsParams {
  page: number;
  pageSize: number;
  storeId: number;
  tenantId: string;
}

export async function listMyLogs(params: ListMyLogsParams) {
  const offset = (params.page - 1) * params.pageSize;

  const records = await query<any>(
    `SELECT ssl.*, s.name AS store_name
     FROM store_status_log ssl
     LEFT JOIN store s ON s.id = ssl.store_id AND s.tenant_id = ssl.tenant_id
     WHERE ssl.store_id = ? AND ssl.tenant_id = ?
     ORDER BY ssl.created_at DESC
     LIMIT ? OFFSET ?`,
    [params.storeId, params.tenantId, params.pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    "SELECT COUNT(*) AS total FROM store_status_log WHERE store_id = ? AND tenant_id = ?",
    [params.storeId, params.tenantId]
  );

  return { total: totalRow?.total ?? 0, page: params.page, pageSize: params.pageSize, records };
}