import { queryWithTenant } from "../../shared/db.js";

/**
 * 商品同步服务：将商品信息同步到小程序端缓存
 */
export async function syncProducts(tenantId: string, spuIds?: number[]) {
  let spus: any[];
  if (spuIds && spuIds.length > 0) {
    const placeholders = spuIds.map(() => "?").join(",");
    spus = await queryWithTenant<any>(
      `SELECT spu.id AS spuId, spu.name, spu.main_image AS mainImage, spu.description, spu.category_id AS categoryId, spu.status,
              spu.brand, spu.unit, spu.store_id AS storeId
       FROM spu WHERE spu.tenant_id = ? AND spu.id IN (${placeholders})`,
      [tenantId, ...spuIds],
      tenantId
    );
  } else {
    spus = await queryWithTenant<any>(
      "SELECT id AS spuId, name, main_image AS mainImage, description, category_id AS categoryId, status, brand, unit, store_id AS storeId FROM spu WHERE tenant_id = ?",
      [tenantId],
      tenantId
    );
  }

  for (const spu of spus) {
    // 获取关联 SKU
    const skus = await queryWithTenant<any>(
      "SELECT id AS skuId, price, cost_price AS costPrice, market_price AS marketPrice, stock_qty AS stockQty FROM sku WHERE spu_id = ? AND tenant_id = ?",
      [spu.spuId, tenantId],
      tenantId
    );

    const syncData = { ...spu, skus };

    await queryWithTenant(
      `INSERT INTO sync_cache (tenant_id, sync_type, entity_id, sync_data, sync_status)
       VALUES (?, 'product', ?, ?, 'synced')
       ON DUPLICATE KEY UPDATE sync_data = ?, sync_status = 'synced', updated_at = NOW()`,
      [tenantId, spu.spuId, JSON.stringify(syncData), JSON.stringify(syncData)],
      tenantId
    );
  }

  return { syncedCount: spus.length };
}