import { queryWithTenant } from "../../shared/db";

/**
 * 获取指定时间之后的价格变更列表
 */
export async function getChangesSince(tenantId: string, since: string) {
  const rows = await queryWithTenant<any>(
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
  const rows = await queryWithTenant<any>(
    `SELECT id AS skuId, spu_id AS spuId, price, cost_price AS costPrice, market_price AS marketPrice
     FROM t_sku WHERE tenant_id = ? AND id IN (${placeholders})`,
    [tenantId, ...ids],
    tenantId
  );
  return rows;
}

/**
 * 价格同步服务：将商品价格同步到小程序端缓存
 */
export async function syncPrices(tenantId: string, skuIds?: number[]) {
  let skus: any[];
  if (skuIds && skuIds.length > 0) {
    const placeholders = skuIds.map(() => "?").join(",");
    skus = await queryWithTenant<any>(
      `SELECT id AS skuId, spu_id AS spuId, price, cost_price AS costPrice, market_price AS marketPrice, store_id AS storeId
       FROM t_sku WHERE tenant_id = ? AND id IN (${placeholders})`,
      [tenantId, ...skuIds],
      tenantId
    );
  } else {
    skus = await queryWithTenant<any>(
      "SELECT id AS skuId, spu_id AS spuId, price, cost_price AS costPrice, market_price AS marketPrice, store_id AS storeId FROM t_sku WHERE tenant_id = ?",
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
  const rows = await queryWithTenant<any>(
    "SELECT sync_status AS syncStatus, COUNT(*) AS count FROM t_sync_cache WHERE tenant_id = ? AND sync_type = ? GROUP BY sync_status",
    [tenantId, syncType],
    tenantId
  );
  return rows;
}

export async function getLastSyncTime(tenantId: string, syncType: string) {
  const row = await queryWithTenant<any>(
    "SELECT MAX(updated_at) AS lastSyncTime FROM t_sync_cache WHERE tenant_id = ? AND sync_type = ?",
    [tenantId, syncType],
    tenantId
  );
  return row?.[0]?.lastSyncTime || null;
}