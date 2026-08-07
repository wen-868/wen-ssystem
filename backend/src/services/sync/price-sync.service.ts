﻿﻿﻿﻿﻿import { queryWithTenant } from "../../shared/db";

// ==================== 数据库行接口定义 ====================

/** 价格变更日志行 — t_price_change_log */
interface PriceChangeLogRow {
  id: number;
  productId: number;
  oldPrice: number | string;
  newPrice: number | string;
  changedAt: string | Date;
}

/** SKU 价格行（按 ID 批量查询）— t_product_sku JOIN t_product_price */
interface SkuPriceRow {
  skuId: number;
  spuId: number;
  price: number | string;
  costPrice: number | string;
  marketPrice: number | string;
}

/** SKU 价格行（含 storeId）— t_product_sku JOIN t_product_price + t_inventory_balance，用于价格同步 */
interface SkuPriceWithStoreRow extends SkuPriceRow {
  storeId: number;
}

/** 同步状态聚合行 — t_sync_cache GROUP BY sync_status */
interface SyncCacheStatusRow {
  syncStatus: string;
  count: number;
}

/** 同步最新时间行 — t_sync_cache MAX(updated_at) */
interface SyncCacheLastTimeRow {
  lastSyncTime: string | Date | null;
}

/**
 * 获取指定时间之后的价格变更列表
 */
export async function getChangesSince(tenantId: string, since: string) {
  const rows = await queryWithTenant<PriceChangeLogRow>(
    "SELECT id, product_id AS productId, old_price AS oldPrice, new_price AS newPrice, changed_at AS changedAt FROM t_price_change_log WHERE tenant_id = ? AND changed_at > ? ORDER BY changed_at ASC",
    [tenantId, since || "1970-01-01"],
    tenantId
  );
  return rows;
}

/**
 * 根据 ID 列表批量获取最新价格
 */
export async function getPricesByIds(tenantId: string, ids: number[]) {
  if (!ids || ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = await queryWithTenant<SkuPriceRow>(
    `SELECT s.id AS skuId, s.spu_id AS spuId, pp.retail_price AS price, pp.cost_price AS costPrice, pp.store_price AS marketPrice
     FROM t_product_sku s
     JOIN t_product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
     WHERE s.tenant_id = ? AND s.id IN (${placeholders})`,
    [tenantId, ...ids],
    tenantId
  );
  return rows;
}

/**
 * 价格同步服务：将商品价格同步到小程序端缓存
 */
export async function syncPrices(tenantId: string, skuIds?: number[]) {
  let skus: SkuPriceWithStoreRow[];
  if (skuIds && skuIds.length > 0) {
    const placeholders = skuIds.map(() => "?").join(",");
    skus = await queryWithTenant<SkuPriceWithStoreRow>(
      `SELECT s.id AS skuId, s.spu_id AS spuId, pp.retail_price AS price, pp.cost_price AS costPrice, pp.store_price AS marketPrice, ib.store_id AS storeId
       FROM t_product_sku s
       JOIN t_product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
       LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.tenant_id = s.tenant_id
       WHERE s.tenant_id = ? AND s.id IN (${placeholders})`,
      [tenantId, ...skuIds],
      tenantId
    );
  } else {
    skus = await queryWithTenant<SkuPriceWithStoreRow>(
      "SELECT s.id AS skuId, s.spu_id AS spuId, pp.retail_price AS price, pp.cost_price AS costPrice, pp.store_price AS marketPrice, ib.store_id AS storeId FROM t_product_sku s JOIN t_product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.tenant_id = s.tenant_id WHERE s.tenant_id = ?",
      [tenantId],
      tenantId
    );
  }

  // 写入价格缓存表
  for (const sku of skus) {
    await queryWithTenant(
      `INSERT INTO t_sync_cache (tenant_id, sync_type, entity_id, sync_data, sync_status)
       VALUES (?, 'price', ?, ?, 'synced')
       ON DUPLICATE KEY UPDATE sync_data = ?, sync_status = 'synced', updated_at = NOW()`,
      [tenantId, sku.skuId, JSON.stringify(sku), JSON.stringify(sku)],
      tenantId
    );
  }

  return { syncedCount: skus.length };
}

export async function getSyncStatus(tenantId: string, syncType: string) {
  const rows = await queryWithTenant<SyncCacheStatusRow>(
    "SELECT sync_status AS syncStatus, COUNT(*) AS count FROM t_sync_cache WHERE tenant_id = ? AND sync_type = ? GROUP BY sync_status",
    [tenantId, syncType],
    tenantId
  );
  return rows;
}

export async function getLastSyncTime(tenantId: string, syncType: string) {
  const row = await queryWithTenant<SyncCacheLastTimeRow>(
    "SELECT MAX(updated_at) AS lastSyncTime FROM t_sync_cache WHERE tenant_id = ? AND sync_type = ?",
    [tenantId, syncType],
    tenantId
  );
  return row?.[0]?.lastSyncTime || null;
}
