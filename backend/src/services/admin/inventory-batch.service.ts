import { z } from "zod";
import { query, queryOne, transaction } from "../../shared/db.js";

// ==================== 批次管理 ====================

export interface ListBatchesParams {
  page: number;
  pageSize: number;
  tenantId: string;
  storeId?: number;
  skuId?: number;
  expiryStatus?: "normal" | "warning" | "danger" | "expired";
}

export async function listBatches(params: ListBatchesParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["ib.tenant_id = ?"];
  const values: unknown[] = [params.tenantId];

  if (params.storeId) {
    conditions.push("ib.store_id = ?");
    values.push(params.storeId);
  }
  if (params.skuId) {
    conditions.push("ib.sku_id = ?");
    values.push(params.skuId);
  }
  if (params.expiryStatus === "expired") {
    conditions.push("ib.expiry_date IS NOT NULL AND ib.expiry_date < CURDATE()");
  } else if (params.expiryStatus === "danger") {
    conditions.push("ib.expiry_date IS NOT NULL AND DATEDIFF(ib.expiry_date, CURDATE()) BETWEEN 0 AND 7");
  } else if (params.expiryStatus === "warning") {
    conditions.push("ib.expiry_date IS NOT NULL AND DATEDIFF(ib.expiry_date, CURDATE()) BETWEEN 8 AND 30");
  } else if (params.expiryStatus === "normal") {
    conditions.push("(ib.expiry_date IS NULL OR DATEDIFF(ib.expiry_date, CURDATE()) > 30)");
  }

  const where = conditions.join(" AND ");

  const records = await query<any>(
    `SELECT ib.*, ps.sku_name, s.name AS store_name
     FROM inventory_batch ib
     LEFT JOIN product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
     LEFT JOIN store s ON s.id = ib.store_id AND s.tenant_id = ib.tenant_id
     WHERE ${where}
     ORDER BY ib.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, params.pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM inventory_batch ib WHERE ${where}`,
    values
  );

  const enriched = records.map((r: any) => {
    let expiryStatusText = "正常";
    let expiryColor = "#10B981";
    if (r.expiry_date) {
      const remaining = r.days_remaining ?? Math.floor((new Date(r.expiry_date).getTime() - Date.now()) / 86400000);
      if (remaining < 0) { expiryStatusText = "已过期"; expiryColor = "#EF4444"; }
      else if (remaining <= 7) { expiryStatusText = "即将过期"; expiryColor = "#EF4444"; }
      else if (remaining <= 15) { expiryStatusText = "临期"; expiryColor = "#F59E0B"; }
      else if (remaining <= 30) { expiryStatusText = "临近效期"; expiryColor = "#F59E0B"; }
    }
    return { ...r, expiryStatusText, expiryColor };
  });

  return { total: totalRow?.total ?? 0, page: params.page, pageSize: params.pageSize, records: enriched };
}

export async function getBatchDetail(id: number, tenantId: string) {
  return queryOne<any>(
    `SELECT ib.*, ps.sku_name, s.name AS store_name
     FROM inventory_batch ib
     LEFT JOIN product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
     LEFT JOIN store s ON s.id = ib.store_id AND s.tenant_id = ib.tenant_id
     WHERE ib.id = ? AND ib.tenant_id = ?`,
    [id, tenantId]
  );
}

export interface CreateBatchBody {
  storeId: number;
  skuId: number;
  batchNo: string;
  quantity: number;
  productionDate?: string;
  expiryDate?: string;
  costPrice?: number;
  supplierId?: number;
  inboundOrderId?: number;
}

export async function createBatch(body: CreateBatchBody, tenantId: string) {
  return transaction(async (conn) => {
    const existing = await conn.execute<any[]>(
      "SELECT id FROM inventory_batch WHERE batch_no = ? AND store_id = ? AND tenant_id = ?",
      [body.batchNo, body.storeId, tenantId]
    );
    if ((existing[0] as any[]).length > 0) {
      throw new Error("批次号已存在");
    }

    const [insertResult] = await conn.execute(
      `INSERT INTO inventory_batch (store_id, sku_id, batch_no, quantity, production_date, expiry_date, cost_price, supplier_id, inbound_order_id, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [body.storeId, body.skuId, body.batchNo, body.quantity, body.productionDate ?? null, body.expiryDate ?? null, body.costPrice ?? null, body.supplierId ?? null, body.inboundOrderId ?? null, tenantId]
    );
    return { batchId: (insertResult as any).insertId };
  });
}

export interface UpdateBatchBody {
  quantity?: number;
  productionDate?: string;
  expiryDate?: string;
  costPrice?: number;
}

export async function updateBatch(id: number, body: UpdateBatchBody, tenantId: string) {
  await transaction(async (conn) => {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (body.quantity !== undefined) { sets.push("quantity = ?"); values.push(body.quantity); }
    if (body.productionDate !== undefined) { sets.push("production_date = ?"); values.push(body.productionDate); }
    if (body.expiryDate !== undefined) { sets.push("expiry_date = ?"); values.push(body.expiryDate); }
    if (body.costPrice !== undefined) { sets.push("cost_price = ?"); values.push(body.costPrice); }

    if (sets.length === 0) return;
    values.push(id, tenantId);
    await conn.execute(`UPDATE inventory_batch SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, values as any[]);
  });
  return { batchId: id };
}

export interface SplitBatchBody {
  splitQuantity: number;
  newBatchNo: string;
}

export async function splitBatch(id: number, body: SplitBatchBody, tenantId: string) {
  return transaction(async (conn) => {
    const [rows] = await conn.execute<any[]>(
      "SELECT * FROM inventory_batch WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const batch = (rows as any[])[0];
    if (!batch) throw new Error("批次不存在");
    if (batch.quantity < body.splitQuantity) throw new Error("拆分数量不能大于批次数量");

    await conn.execute(
      "UPDATE inventory_batch SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?",
      [body.splitQuantity, id, tenantId]
    );

    const [insertResult] = await conn.execute(
      `INSERT INTO inventory_batch (store_id, sku_id, batch_no, quantity, locked_quantity, production_date, expiry_date, cost_price, supplier_id, inbound_order_id, tenant_id)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
      [batch.store_id, batch.sku_id, body.newBatchNo, body.splitQuantity, batch.production_date, batch.expiry_date, batch.cost_price, batch.supplier_id, batch.inbound_order_id, tenantId]
    );
    return { newBatchId: (insertResult as any).insertId };
  });
}

export async function getFifoSuggestion(storeId: number, skuId: number, tenantId: string) {
  return query<any>(
    `SELECT ib.*, ps.sku_name,
            DATEDIFF(ib.expiry_date, CURDATE()) AS days_remaining
     FROM inventory_batch ib
     LEFT JOIN product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
     WHERE ib.store_id = ? AND ib.sku_id = ? AND ib.quantity > ib.locked_quantity AND ib.tenant_id = ?
     ORDER BY ib.expiry_date ASC, ib.production_date ASC
     FOR UPDATE`,
    [storeId, skuId, tenantId]
  );
}

// ==================== 效期预警配置 ====================

export async function listExpiryConfigs(tenantId: string) {
  return query<any>(
    "SELECT * FROM expiry_alert_config WHERE tenant_id = ? ORDER BY alert_level ASC",
    [tenantId]
  );
}

export interface CreateExpiryConfigBody {
  alertLevel: number;
  levelName: string;
  daysBeforeExpiry: number;
  action: "REMIND" | "RESTRICT" | "BLOCK";
  color: string;
  enabled: boolean;
  description: string;
}

export async function createExpiryConfig(body: CreateExpiryConfigBody, tenantId: string) {
  const result = await query<any>(
    `INSERT INTO expiry_alert_config (alert_level, level_name, days_before_expiry, action, color, enabled, description, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [body.alertLevel, body.levelName, body.daysBeforeExpiry, body.action, body.color, body.enabled ? 1 : 0, body.description, tenantId]
  );
  return { configId: (result as any).insertId };
}

export interface UpdateExpiryConfigBody {
  levelName?: string;
  daysBeforeExpiry?: number;
  action?: "REMIND" | "RESTRICT" | "BLOCK";
  color?: string;
  enabled?: boolean;
  description?: string;
}

export async function updateExpiryConfig(id: number, body: UpdateExpiryConfigBody, tenantId: string) {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (body.levelName !== undefined) { sets.push("level_name = ?"); values.push(body.levelName); }
  if (body.daysBeforeExpiry !== undefined) { sets.push("days_before_expiry = ?"); values.push(body.daysBeforeExpiry); }
  if (body.action !== undefined) { sets.push("action = ?"); values.push(body.action); }
  if (body.color !== undefined) { sets.push("color = ?"); values.push(body.color); }
  if (body.enabled !== undefined) { sets.push("enabled = ?"); values.push(body.enabled ? 1 : 0); }
  if (body.description !== undefined) { sets.push("description = ?"); values.push(body.description); }

  if (sets.length === 0) {
    return { configId: id };
  }
  values.push(id, tenantId);
  await query(`UPDATE expiry_alert_config SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, values);
  return { configId: id };
}

export async function deleteExpiryConfig(id: number, tenantId: string) {
  await query("DELETE FROM expiry_alert_config WHERE id = ? AND tenant_id = ?", [id, tenantId]);
  return { configId: id };
}

// ==================== 效期预警记录 ====================

export interface ListExpiryAlertsParams {
  page: number;
  pageSize: number;
  tenantId: string;
  alertLevel?: number;
  status?: "PENDING" | "HANDLED" | "EXPIRED";
  storeId?: number;
}

export async function listExpiryAlerts(params: ListExpiryAlertsParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["ear.tenant_id = ?"];
  const values: unknown[] = [params.tenantId];

  if (params.alertLevel !== undefined) {
    conditions.push("ear.alert_level = ?");
    values.push(params.alertLevel);
  }
  if (params.status) {
    conditions.push("ear.status = ?");
    values.push(params.status);
  }
  if (params.storeId) {
    conditions.push("ear.store_id = ?");
    values.push(params.storeId);
  }

  const where = conditions.join(" AND ");

  const records = await query<any>(
    `SELECT ear.*, s.name AS store_name
     FROM expiry_alert_record ear
     LEFT JOIN store s ON s.id = ear.store_id AND s.tenant_id = ear.tenant_id
     WHERE ${where}
     ORDER BY ear.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, params.pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM expiry_alert_record ear WHERE ${where}`,
    values
  );

  return { total: totalRow?.total ?? 0, page: params.page, pageSize: params.pageSize, records };
}

export interface HandleExpiryAlertBody {
  remark?: string;
}

export async function handleExpiryAlert(id: number, body: HandleExpiryAlertBody, tenantId: string, userId: number) {
  await transaction(async (conn) => {
    await conn.execute(
      `UPDATE expiry_alert_record SET status = 'HANDLED', handled_by = ?, handled_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [userId ?? null, id, tenantId] as any[]
    );
  });
  return { alertId: id };
}

export async function getExpiryAlertStatistics(tenantId: string) {
  const stats = await query<any>(
    `SELECT alert_level, COUNT(*) AS count, SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_count
     FROM expiry_alert_record
     WHERE tenant_id = ?
     GROUP BY alert_level
     ORDER BY alert_level ASC`,
    [tenantId]
  );

  const totalPending = await queryOne<any>(
    "SELECT COUNT(*) AS total FROM expiry_alert_record WHERE status = 'PENDING' AND tenant_id = ?",
    [tenantId]
  );

  const trend = await query<any>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM expiry_alert_record
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND tenant_id = ?
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [tenantId]
  );

  return {
    byLevel: stats,
    totalPending: totalPending?.total ?? 0,
    trend
  };
}