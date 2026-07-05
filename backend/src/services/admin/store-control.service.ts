import { query, queryOne, transaction } from "../../shared/db.js";

// ==================== Admin 端 ====================

export async function getConfigs(tenantId: string) {
  const records = await query<Record<string, unknown>>(
    `SELECT scc.*, s.name AS store_name, s.status AS store_status
     FROM store_control_config scc
     LEFT JOIN store s ON s.id = scc.store_id AND s.tenant_id = scc.tenant_id
     WHERE scc.tenant_id = ?
     ORDER BY scc.id ASC`,
    [tenantId]
  );
  return records;
}

export async function getConfig(storeId: number, tenantId: string) {
  const config = await queryOne<any>(
    `SELECT scc.*, s.name AS store_name, s.status AS store_status
     FROM store_control_config scc
     LEFT JOIN store s ON s.id = scc.store_id AND s.tenant_id = scc.tenant_id
     WHERE scc.store_id = ? AND scc.tenant_id = ?`,
    [storeId, tenantId]
  );
  return config ?? null;
}

export async function upsertConfig(params: {
  storeId: number; tenantId: string;
  autoOpenTime?: string | null; autoCloseTime?: string | null;
  maxDailyOrders?: number | null; maxOrderAmount?: number | null;
}) {
  const { storeId, tenantId, autoOpenTime, autoCloseTime, maxDailyOrders, maxOrderAmount } = params;

  await transaction(async (conn) => {
    const [existing] = await conn.execute(
      "SELECT id FROM store_control_config WHERE store_id = ? AND tenant_id = ?",
      [storeId, tenantId]
    );

    if ((existing as unknown as Record<string, unknown>[]).length > 0) {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (autoOpenTime !== undefined) { sets.push("auto_open_time = ?"); values.push(autoOpenTime); }
      if (autoCloseTime !== undefined) { sets.push("auto_close_time = ?"); values.push(autoCloseTime); }
      if (maxDailyOrders !== undefined) { sets.push("max_daily_orders = ?"); values.push(maxDailyOrders); }
      if (maxOrderAmount !== undefined) { sets.push("max_order_amount = ?"); values.push(maxOrderAmount); }
      if (sets.length > 0) {
        values.push(storeId, tenantId);
        await conn.execute(`UPDATE store_control_config SET ${sets.join(", ")} WHERE store_id = ? AND tenant_id = ?`, values as Record<string, unknown>[]);
      }
    } else {
      await conn.execute(
        `INSERT INTO store_control_config (store_id, auto_open_time, auto_close_time, max_daily_orders, max_order_amount, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [storeId, autoOpenTime ?? null, autoCloseTime ?? null, maxDailyOrders ?? null, maxOrderAmount ?? null, tenantId]
      );
    }
  });

  return { storeId };
}

export async function openStore(params: {
  storeId: number; tenantId: string; userId: number;
}) {
  const { storeId, tenantId, userId } = params;

  await transaction(async (conn) => {
    const [rows] = await conn.execute(
      "SELECT status FROM store WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [storeId, tenantId]
    );
    const store = (rows as unknown as Record<string, unknown>[])[0];
    if (!store) throw new Error("门店不存在");

    const fromStatus = store.status || "CLOSED";
    await conn.execute(
      "UPDATE store SET status = 'OPEN' WHERE id = ? AND tenant_id = ?",
      [storeId, tenantId]
    );
    await conn.execute(
      `INSERT INTO store_status_log (store_id, from_status, to_status, change_type, operator_id, remark, tenant_id)
       VALUES (?, ?, 'OPEN', 'MANUAL', ?, '手动开门', ?)`,
      [storeId, fromStatus, userId, tenantId]
    );
  });

  return { storeId, status: "OPEN" };
}

export async function closeStore(params: {
  storeId: number; tenantId: string; userId: number;
}) {
  const { storeId, tenantId, userId } = params;

  await transaction(async (conn) => {
    const [rows] = await conn.execute(
      "SELECT status FROM store WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [storeId, tenantId]
    );
    const store = (rows as unknown as Record<string, unknown>[])[0];
    if (!store) throw new Error("门店不存在");

    const fromStatus = store.status || "OPEN";
    await conn.execute(
      "UPDATE store SET status = 'CLOSED' WHERE id = ? AND tenant_id = ?",
      [storeId, tenantId]
    );
    await conn.execute(
      `INSERT INTO store_status_log (store_id, from_status, to_status, change_type, operator_id, remark, tenant_id)
       VALUES (?, ?, 'CLOSED', 'MANUAL', ?, '手动关门', ?)`,
      [storeId, fromStatus, userId, tenantId]
    );
  });

  return { storeId, status: "CLOSED" };
}

export async function suspendStore(params: {
  storeId: number; tenantId: string; userId: number; reason?: string;
}) {
  const { storeId, tenantId, userId, reason } = params;

  await transaction(async (conn) => {
    const [rows] = await conn.execute(
      "SELECT status FROM store WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [storeId, tenantId]
    );
    const store = (rows as unknown as Record<string, unknown>[])[0];
    if (!store) throw new Error("门店不存在");

    const fromStatus = store.status || "OPEN";
    const remark = reason || "手动暂停营业";
    await conn.execute(
      "UPDATE store SET status = 'SUSPENDED' WHERE id = ? AND tenant_id = ?",
      [storeId, tenantId]
    );
    await conn.execute(
      `INSERT INTO store_status_log (store_id, from_status, to_status, change_type, operator_id, remark, tenant_id)
       VALUES (?, ?, 'SUSPENDED', 'MANUAL', ?, ?, ?)`,
      [storeId, fromStatus, userId, remark, tenantId]
    );
    await conn.execute(
      `INSERT INTO store_control_config (store_id, suspended_reason, tenant_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE suspended_reason = ?`,
      [storeId, remark, tenantId, remark]
    );
  });

  return { storeId, status: "SUSPENDED" };
}

export async function resumeStore(params: {
  storeId: number; tenantId: string; userId: number;
}) {
  const { storeId, tenantId, userId } = params;

  await transaction(async (conn) => {
    const [rows] = await conn.execute(
      "SELECT status FROM store WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [storeId, tenantId]
    );
    const store = (rows as unknown as Record<string, unknown>[])[0];
    if (!store) throw new Error("门店不存在");

    const fromStatus = store.status || "SUSPENDED";
    await conn.execute(
      "UPDATE store SET status = 'OPEN' WHERE id = ? AND tenant_id = ?",
      [storeId, tenantId]
    );
    await conn.execute(
      `INSERT INTO store_status_log (store_id, from_status, to_status, change_type, operator_id, remark, tenant_id)
       VALUES (?, ?, 'OPEN', 'MANUAL', ?, '恢复营业', ?)`,
      [storeId, fromStatus, userId, tenantId]
    );
    await conn.execute(
      "UPDATE store_control_config SET suspended_reason = NULL WHERE store_id = ? AND tenant_id = ?",
      [storeId, tenantId]
    );
  });

  return { storeId, status: "OPEN" };
}

export async function getLogs(params: {
  page: number; pageSize: number; tenantId: string;
  storeId?: number; changeType?: string;
}) {
  const { page, pageSize, tenantId, storeId, changeType } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["ssl.tenant_id = ?"];
  const values: unknown[] = [tenantId];

  if (storeId !== undefined) {
    conditions.push("ssl.store_id = ?");
    values.push(storeId);
  }
  if (changeType) {
    conditions.push("ssl.change_type = ?");
    values.push(changeType);
  }

  const where = conditions.join(" AND ");

  const records = await query<Record<string, unknown>>(
    `SELECT ssl.*, s.name AS store_name
     FROM store_status_log ssl
     LEFT JOIN store s ON s.id = ssl.store_id AND s.tenant_id = ssl.tenant_id
     WHERE ${where}
     ORDER BY ssl.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );

  const totalRow = await queryOne<any>(`SELECT COUNT(*) AS total FROM store_status_log ssl WHERE ${where}`, values);

  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

// ==================== Store 端 ====================

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

export async function getMyLogs(params: {
  storeId: number; tenantId: string; page: number; pageSize: number;
}) {
  const { storeId, tenantId, page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  const records = await query<Record<string, unknown>>(
    `SELECT ssl.*, s.name AS store_name
     FROM store_status_log ssl
     LEFT JOIN store s ON s.id = ssl.store_id AND s.tenant_id = ssl.tenant_id
     WHERE ssl.store_id = ? AND ssl.tenant_id = ?
     ORDER BY ssl.created_at DESC
     LIMIT ? OFFSET ?`,
    [storeId, tenantId, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    "SELECT COUNT(*) AS total FROM store_status_log WHERE store_id = ? AND tenant_id = ?",
    [storeId, tenantId]
  );

  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

// ==================== 定时检查器辅助函数 ====================

export async function getTenantIds() {
  const tenantRows = await query<Record<string, unknown>>(
    "SELECT DISTINCT tenant_id FROM store_control_config"
  );
  return tenantRows.map((r: Record<string, unknown>) => r.tenant_id).filter(Boolean);
}

export async function getConfigsForCheck(tenantId: string) {
  return query<Record<string, unknown>>(
    `SELECT scc.*, s.status AS current_status, s.name AS store_name
     FROM store_control_config scc
     JOIN store s ON s.id = scc.store_id AND s.tenant_id = scc.tenant_id
     WHERE scc.tenant_id = ?
       AND s.status IN ('OPEN', 'CLOSED')`,
    [tenantId]
  );
}

export async function getOrderCount(storeId: number, tenantId: string, conn: { execute: (sql: string, params: unknown[]) => Promise<unknown[]> }) {
  const [orderRows] = await conn.execute(
    `SELECT COUNT(*) AS order_count FROM sale_bill
     WHERE store_id = ? AND tenant_id = ? AND DATE(created_at) = CURDATE() AND business_status NOT IN ('DRAFT', 'VOIDED')`,
    [storeId, tenantId]
  );
  return (orderRows as unknown as Record<string, unknown>[])[0]?.order_count ?? 0;
}

export async function getOrderAmount(storeId: number, tenantId: string, conn: { execute: (sql: string, params: unknown[]) => Promise<unknown[]> }) {
  const [amountRows] = await conn.execute(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS total_amount FROM sale_bill
     WHERE store_id = ? AND tenant_id = ? AND DATE(created_at) = CURDATE() AND business_status NOT IN ('DRAFT', 'VOIDED')`,
    [storeId, tenantId]
  );
  return Number((amountRows as unknown as Record<string, unknown>[])[0]?.total_amount ?? 0);
}