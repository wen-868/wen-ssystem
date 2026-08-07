import { query, queryOne, transaction } from "../../shared/db";
import type { RowDataPacket } from "mysql2";
import type { ResultSetHeader } from "mysql2/promise";

// ==================== 类型定义 ====================

/** 库存批次行（SELECT * FROM t_inventory_batch） */
interface InventoryBatchRow extends RowDataPacket {
  id: number | string;
  tenant_id: string;
  store_id: number | string;
  sku_id: number | string;
  batch_no: string;
  quantity: number | string;
  locked_quantity: number | string;
  production_date: string | Date | null;
  expiry_date: string | Date | null;
  cost_price: number | string | null;
  supplier_id: number | string | null;
  inbound_order_id: number | string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

/** 库存批次 ID 行（用于存在性检查） */
interface InventoryBatchIdRow extends RowDataPacket {
  id: number | string;
}

/** 天数差值行（SELECT DATEDIFF(...)） */
interface DaysRemainingRow extends RowDataPacket {
  days_remaining: number | string | null;
}

/** 效期预警记录 ID 行（用于存在性检查） */
interface ExpiryAlertIdRow extends RowDataPacket {
  id: number | string;
}

/** 租户 ID 行（SELECT DISTINCT tenant_id） */
interface TenantIdRow {
  tenant_id: string;
}

/** 效期扫描批次行（含 JOIN 商品 SKU 名） */
interface ExpiryScanBatchRow {
  id: number | string;
  store_id: number | string;
  sku_id: number | string;
  sku_name: string | null;
  batch_no: string;
  production_date: string | Date | null;
  expiry_date: string | Date | null;
  quantity: number | string;
  tenant_id: string;
}

/** 效期预警配置行（SELECT * FROM t_expiry_alert_config） */
interface ExpiryAlertConfigRow {
  alert_level: number | string;
  days_before_expiry: number | string;
  action: string;
  level_name: string;
  color: string;
  enabled: number | boolean;
  description: string;
  tenant_id: string;
}

// ==================== 批次管理 ====================

export async function listBatches(tenantId: string, params: {
  page: number; pageSize: number; storeId?: number; skuId?: number; expiryStatus?: string;
}) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["ib.tenant_id = ?"];
  const values: unknown[] = [tenantId];

  if (params.storeId) { conditions.push("ib.store_id = ?"); values.push(params.storeId); }
  if (params.skuId) { conditions.push("ib.sku_id = ?"); values.push(params.skuId); }
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

  const records = await query<Record<string, unknown>>(
    `SELECT ib.*, ps.sku_name, s.name AS store_name
     FROM t_inventory_batch ib
     LEFT JOIN t_product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
     LEFT JOIN t_store s ON s.id = ib.store_id AND s.tenant_id = ib.tenant_id
     WHERE ${where}
     ORDER BY ib.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, params.pageSize, offset]
  );

  const totalRow = await queryOne<Record<string, unknown>>(`SELECT COUNT(*) AS total FROM t_inventory_batch ib WHERE ${where}`, values);

  const enriched = records.map((r: Record<string, unknown>) => {
    let expiryStatusText = "正常";
    let expiryColor = "#10B981";
    if (r.expiry_date) {
      const remaining = r.days_remaining != null ? Number(r.days_remaining) : Math.floor((new Date(String(r.expiry_date)).getTime() - Date.now()) / 86400000);
      if (remaining < 0) { expiryStatusText = "已过期"; expiryColor = "#EF4444"; }
      else if (remaining <= 7) { expiryStatusText = "即将过期"; expiryColor = "#EF4444"; }
      else if (remaining <= 15) { expiryStatusText = "临期"; expiryColor = "#F59E0B"; }
      else if (remaining <= 30) { expiryStatusText = "临近效期"; expiryColor = "#F59E0B"; }
    }
    return { ...r, expiryStatusText, expiryColor };
  });

  return { total: totalRow?.total ?? 0, page: params.page, pageSize: params.pageSize, records: enriched };
}

export async function getBatchDetail(tenantId: string, id: number) {
  return queryOne<Record<string, unknown>>(
    `SELECT ib.*, ps.sku_name, s.name AS store_name
     FROM t_inventory_batch ib
     LEFT JOIN t_product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
     LEFT JOIN t_store s ON s.id = ib.store_id AND s.tenant_id = ib.tenant_id
     WHERE ib.id = ? AND ib.tenant_id = ?`,
    [id, tenantId]
  );
}

export async function createBatch(tenantId: string, body: {
  storeId: number; skuId: number; batchNo: string; quantity: number;
  productionDate?: string; expiryDate?: string; costPrice?: number;
  supplierId?: number; inboundOrderId?: number;
}) {
  return transaction(async (conn) => {
    const [existing] = await conn.execute<InventoryBatchIdRow[]>(
      "SELECT id FROM t_inventory_batch WHERE batch_no = ? AND store_id = ? AND tenant_id = ?",
      [body.batchNo, body.storeId, tenantId]
    );
    if (existing.length > 0) {
      throw new Error("批次号已存在");
    }

    const [insertResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO t_inventory_batch (store_id, sku_id, batch_no, quantity, production_date, expiry_date, cost_price, supplier_id, inbound_order_id, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [body.storeId, body.skuId, body.batchNo, body.quantity, body.productionDate ?? null, body.expiryDate ?? null, body.costPrice ?? null, body.supplierId ?? null, body.inboundOrderId ?? null, tenantId]
    );
    return insertResult.insertId;
  });
}

export async function updateBatch(tenantId: string, id: number, body: {
  quantity?: number; productionDate?: string; expiryDate?: string; costPrice?: number;
}) {
  await transaction(async (conn) => {
    const sets: string[] = [];
    const values: (string | number)[] = [];
    if (body.quantity !== undefined) { sets.push("quantity = ?"); values.push(body.quantity); }
    if (body.productionDate !== undefined) { sets.push("production_date = ?"); values.push(body.productionDate); }
    if (body.expiryDate !== undefined) { sets.push("expiry_date = ?"); values.push(body.expiryDate); }
    if (body.costPrice !== undefined) { sets.push("cost_price = ?"); values.push(body.costPrice); }

    if (sets.length === 0) return;
    values.push(id, tenantId);
    await conn.execute<ResultSetHeader>(`UPDATE t_inventory_batch SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, values);
  });
}

export async function splitBatch(tenantId: string, id: number, body: { splitQuantity: number; newBatchNo: string }) {
  return transaction(async (conn) => {
    const [rows] = await conn.execute<InventoryBatchRow[]>(
      "SELECT * FROM t_inventory_batch WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [id, tenantId]
    );
    const batch = rows[0];
    if (!batch) throw new Error("批次不存在");
    if (Number(batch.quantity) < body.splitQuantity) throw new Error("拆分数量不能大于批次数量");

    await conn.execute<ResultSetHeader>(
      "UPDATE t_inventory_batch SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?",
      [body.splitQuantity, id, tenantId]
    );

    const [insertResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO t_inventory_batch (store_id, sku_id, batch_no, quantity, locked_quantity, production_date, expiry_date, cost_price, supplier_id, inbound_order_id, tenant_id)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
      [batch.store_id, batch.sku_id, body.newBatchNo, body.splitQuantity, batch.production_date, batch.expiry_date, batch.cost_price, batch.supplier_id, batch.inbound_order_id, tenantId]
    );
    return insertResult.insertId;
  });
}

export async function getFifoSuggestion(tenantId: string, storeId: number, skuId: number) {
  return query<Record<string, unknown>>(
    `SELECT ib.*, ps.sku_name,
            DATEDIFF(ib.expiry_date, CURDATE()) AS days_remaining
     FROM t_inventory_batch ib
     LEFT JOIN t_product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
     WHERE ib.store_id = ? AND ib.sku_id = ? AND ib.quantity > ib.locked_quantity AND ib.tenant_id = ?
     ORDER BY ib.expiry_date ASC, ib.production_date ASC
     FOR UPDATE`,
    [storeId, skuId, tenantId]
  );
}

// ==================== 批次追溯 ====================

export async function getBatchTrace(tenantId: string, id: number) {
  const batch = await queryOne<Record<string, unknown>>(
    `SELECT ib.*, ps.sku_name, ps.spu_id, p.name AS spu_name
     FROM t_inventory_batch ib
     LEFT JOIN t_product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
     LEFT JOIN t_product_spu p ON p.id = ps.spu_id AND p.tenant_id = ib.tenant_id
     WHERE ib.id = ? AND ib.tenant_id = ?`,
    [id, tenantId]
  );
  if (!batch) throw Object.assign(new Error("批次不存在"), { statusCode: 404 });

  const trace: Array<{ type: string; date: string; title: string; detail: string; refNo?: string }> = [];

  // 1. 采购
  if (batch.inbound_order_id) {
    const inStockRows = await query<Record<string, unknown>>(
      `SELECT stock_no, created_at FROM t_purchase_in_stock WHERE id = ? AND tenant_id = ?`,
      [batch.inbound_order_id, tenantId]
    );
    const inStock = inStockRows?.[0];
    if (inStock) {
      trace.push({
        type: "purchase",
        date: String(inStock.created_at ?? "").substring(0, 10) || "",
        title: `采购入库 ${inStock.stock_no}`,
        detail: `入库 ${batch.quantity ?? 0} 瓶`,
        refNo: String(inStock.stock_no ?? ""),
      });
    }
  }

  // 2. 出库记录
  const saleItems = await query<Record<string, unknown>>(
    `SELECT il.biz_no AS bill_no, il.created_at, ABS(il.change_qty) AS quantity
     FROM t_inventory_ledger il
     WHERE il.sku_id = (SELECT ib.sku_id FROM t_inventory_batch ib WHERE ib.id = ? AND ib.tenant_id = ?)
       AND il.tenant_id = ? AND il.biz_type = 'SALE_OUT' AND il.change_qty < 0
     ORDER BY il.created_at ASC`,
    [id, tenantId, tenantId]
  );
  for (const item of saleItems) {
    trace.push({
      type: "sale",
      date: String(item.created_at ?? "").substring(0, 10) || "",
      title: `出库 ${item.quantity ?? 0} 瓶`,
      detail: `→ 销售单 ${item.bill_no}`,
      refNo: String(item.bill_no ?? ""),
    });
  }

  // 3. 当前库存
  trace.push({
    type: "current",
    date: "",
    title: `当前库存：${batch.quantity ?? 0} 瓶`,
    detail: batch.batch_no ? `批次号：${batch.batch_no}` : "",
  });

  return trace;
}

export async function getProductBatches(tenantId: string, spuId: number) {
  return query<Record<string, unknown>>(
    `SELECT ib.*, ps.sku_name, ps.spu_id
     FROM t_inventory_batch ib
     JOIN t_product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
     WHERE ps.spu_id = ? AND ib.tenant_id = ?
     ORDER BY ib.production_date DESC, ib.created_at DESC`,
    [spuId, tenantId]
  );
}

// ==================== 效期预警配置 ====================

export async function listExpiryConfigs(tenantId: string) {
  return query<Record<string, unknown>>(
    "SELECT * FROM t_expiry_alert_config WHERE tenant_id = ? ORDER BY alert_level ASC",
    [tenantId]
  );
}

export async function createExpiryConfig(tenantId: string, body: {
  alertLevel: number; levelName: string; daysBeforeExpiry: number;
  action: string; color: string; enabled: boolean; description: string;
}) {
  const result = await query<Record<string, unknown>>(
    `INSERT INTO t_expiry_alert_config (alert_level, level_name, days_before_expiry, action, color, enabled, description, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [body.alertLevel, body.levelName, body.daysBeforeExpiry, body.action, body.color, body.enabled ? 1 : 0, body.description, tenantId]
  );
  return (result as unknown as Record<string, unknown>).insertId;
}

export async function updateExpiryConfig(tenantId: string, id: number, body: {
  levelName?: string; daysBeforeExpiry?: number; action?: string;
  color?: string; enabled?: boolean; description?: string;
}) {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (body.levelName !== undefined) { sets.push("level_name = ?"); values.push(body.levelName); }
  if (body.daysBeforeExpiry !== undefined) { sets.push("days_before_expiry = ?"); values.push(body.daysBeforeExpiry); }
  if (body.action !== undefined) { sets.push("action = ?"); values.push(body.action); }
  if (body.color !== undefined) { sets.push("color = ?"); values.push(body.color); }
  if (body.enabled !== undefined) { sets.push("enabled = ?"); values.push(body.enabled ? 1 : 0); }
  if (body.description !== undefined) { sets.push("description = ?"); values.push(body.description); }

  if (sets.length === 0) return;
  values.push(id, tenantId);
  await query(`UPDATE t_expiry_alert_config SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, values);
}

export async function deleteExpiryConfig(tenantId: string, id: number) {
  await query("DELETE FROM t_expiry_alert_config WHERE id = ? AND tenant_id = ?", [id, tenantId]);
}

// ==================== 效期预警记录 ====================

export async function listExpiryAlerts(tenantId: string, params: {
  page: number; pageSize: number; alertLevel?: number; status?: string; storeId?: number;
}) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["ear.tenant_id = ?"];
  const values: unknown[] = [tenantId];

  if (params.alertLevel !== undefined) { conditions.push("ear.alert_level = ?"); values.push(params.alertLevel); }
  if (params.status) { conditions.push("ear.status = ?"); values.push(params.status); }
  if (params.storeId) { conditions.push("ear.store_id = ?"); values.push(params.storeId); }

  const where = conditions.join(" AND ");

  const records = await query<Record<string, unknown>>(
    `SELECT ear.*, s.name AS store_name
     FROM t_expiry_alert_record ear
     LEFT JOIN t_store s ON s.id = ear.store_id AND s.tenant_id = ear.tenant_id
     WHERE ${where}
     ORDER BY ear.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, params.pageSize, offset]
  );

  const totalRow = await queryOne<Record<string, unknown>>(`SELECT COUNT(*) AS total FROM t_expiry_alert_record ear WHERE ${where}`, values);

  return { total: totalRow?.total ?? 0, page: params.page, pageSize: params.pageSize, records };
}

export async function handleExpiryAlert(tenantId: string, id: number, userId: number | undefined) {
  await transaction(async (conn) => {
    await conn.execute<ResultSetHeader>(
      `UPDATE t_expiry_alert_record SET status = 'HANDLED', handled_by = ?, handled_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [userId ?? null, id, tenantId]
    );
  });
}

export async function getExpiryAlertStatistics(tenantId: string) {
  const stats = await query<Record<string, unknown>>(
    `SELECT alert_level, COUNT(*) AS count, SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_count
     FROM t_expiry_alert_record
     WHERE tenant_id = ?
     GROUP BY alert_level
     ORDER BY alert_level ASC`,
    [tenantId]
  );

  const totalPending = await queryOne<Record<string, unknown>>(
    "SELECT COUNT(*) AS total FROM t_expiry_alert_record WHERE status = 'PENDING' AND tenant_id = ?",
    [tenantId]
  );

  const trend = await query<Record<string, unknown>>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM t_expiry_alert_record
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND tenant_id = ?
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [tenantId]
  );

  return { byLevel: stats, totalPending: totalPending?.total ?? 0, trend };
}

// ==================== 效期扫描器 ====================

export async function runExpiryScan() {
  const tenantRows = await query<TenantIdRow>(
    "SELECT DISTINCT tenant_id FROM t_inventory_batch WHERE expiry_date IS NOT NULL"
  );
  const tenantIds = tenantRows.map((r) => r.tenant_id).filter(Boolean);

  if (tenantIds.length === 0) return;

  for (const tenantId of tenantIds) {
    const configs = await query<ExpiryAlertConfigRow>(
      "SELECT * FROM t_expiry_alert_config WHERE tenant_id = ? AND enabled = 1 ORDER BY days_before_expiry DESC",
      [tenantId]
    );
    if (configs.length === 0) continue;

    const batches = await query<ExpiryScanBatchRow>(
      `SELECT ib.*, ps.sku_name
       FROM t_inventory_batch ib
       LEFT JOIN t_product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
       WHERE ib.tenant_id = ?
         AND ib.expiry_date IS NOT NULL
         AND ib.quantity > 0`,
      [tenantId]
    );

    if (batches.length === 0) continue;

    await transaction(async (conn) => {
      for (const batch of batches) {
        const [rows] = await conn.execute<DaysRemainingRow[]>(
          "SELECT DATEDIFF(?, CURDATE()) AS days_remaining",
          [batch.expiry_date]
        );
        const daysRemaining = Number(rows[0]?.days_remaining ?? 0);

        let matchedConfig: ExpiryAlertConfigRow | null = null;
        for (const config of configs) {
          if (daysRemaining <= Number(config.days_before_expiry) && daysRemaining >= 0) {
            matchedConfig = config;
            break;
          }
        }

        if (daysRemaining < 0) {
          await conn.execute<ResultSetHeader>(
            "UPDATE t_expiry_alert_record SET status = 'EXPIRED' WHERE batch_id = ? AND tenant_id = ? AND status = 'PENDING'",
            [batch.id, tenantId]
          );
          continue;
        }

        if (!matchedConfig) continue;

        const [existing] = await conn.execute<ExpiryAlertIdRow[]>(
          "SELECT id FROM t_expiry_alert_record WHERE batch_id = ? AND tenant_id = ? AND alert_level = ? AND status = 'PENDING'",
          [batch.id, tenantId, matchedConfig.alert_level]
        );

        if (existing.length > 0) {
          await conn.execute<ResultSetHeader>(
            "UPDATE t_expiry_alert_record SET days_remaining = ? WHERE batch_id = ? AND tenant_id = ? AND alert_level = ? AND status = 'PENDING'",
            [daysRemaining, batch.id, tenantId, matchedConfig.alert_level]
          );
          continue;
        }

        await conn.execute<ResultSetHeader>(
          `INSERT INTO t_expiry_alert_record (tenant_id, batch_id, store_id, sku_id, sku_name, batch_no, production_date, expiry_date, days_remaining, alert_level, action_taken, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
          [tenantId, batch.id, batch.store_id, batch.sku_id, batch.sku_name || "", batch.batch_no, batch.production_date, batch.expiry_date, daysRemaining, matchedConfig.alert_level, matchedConfig.action]
        );

        if (matchedConfig.action === "BLOCK") {
          await conn.execute<ResultSetHeader>(
            "UPDATE t_inventory_batch SET locked_quantity = quantity WHERE id = ? AND tenant_id = ? AND locked_quantity < quantity",
            [batch.id, tenantId]
          );
        }
      }
    });
  }
}
