import { queryWithTenant } from "../../shared/db.js";

/**
 * 价格同步服务：将商品价格同步到小程序端缓存
 */
export async function syncPrices(tenantId: string, skuIds?: number[]) {
  let skus: any[];
  if (skuIds && skuIds.length > 0) {
    const placeholders = skuIds.map(() => "?").join(",");
    skus = await queryWithTenant<any>(
      `SELECT id AS skuId, spu_id AS spuId, price, cost_price AS costPrice, market_price AS marketPrice, store_id AS storeId
       FROM sku WHERE tenant_id = ? AND id IN (${placeholders})`,
      [tenantId, ...skuIds],
      tenantId
    );
  } else {
    skus = await queryWithTenant<any>(
      "SELECT id AS skuId, spu_id AS spuId, price, cost_price AS costPrice, market_price AS marketPrice, store_id AS storeId FROM sku WHERE tenant_id = ?",
      [tenantId],
      tenantId
    );
  }

  // 写入价格缓存表
  for (const sku of skus) {
    await queryWithTenant(
      `INSERT INTO sync_cache (tenant_id, sync_type, entity_id, sync_data, sync_status)
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
    "SELECT sync_status AS syncStatus, COUNT(*) AS count FROM sync_cache WHERE tenant_id = ? AND sync_type = ? GROUP BY sync_status",
    [tenantId, syncType],
    tenantId
  );
  return rows;
}

export async function getLastSyncTime(tenantId: string, syncType: string) {
  const row = await queryWithTenant<any>(
    "SELECT MAX(updated_at) AS lastSyncTime FROM sync_cache WHERE tenant_id = ? AND sync_type = ?",
    [tenantId, syncType],
    tenantId
  );
  return row?.[0]?.lastSyncTime || null;
}