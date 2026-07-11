import { queryWithTenant } from "../../shared/db.js";
import logger from "../../shared/logger.js";

/**
 * 商品同步服务：将商品信息同步到小程序端缓存
 * 注意：禁止线上销售的商品（按分类判断）不会同步到小程序
 */
export async function syncProducts(tenantId: string, spuIds?: number[]) {
  let spus: any[];
  if (spuIds && spuIds.length > 0) {
    const placeholders = spuIds.map(() => "?").join(",");
    spus = await queryWithTenant<any>(
      `SELECT spu.id AS spuId, spu.name, spu.main_image AS mainImage, spu.description, spu.category_id AS categoryId, spu.status,
              spu.brand, spu.unit, spu.store_id AS storeId,
              cat.allow_online_sale AS allowOnlineSale
       FROM t_product_spu spu
       INNER JOIN t_product_category cat ON spu.category_id = cat.id
       WHERE spu.tenant_id = ? AND spu.id IN (${placeholders})`,
      [tenantId, ...spuIds],
      tenantId
    );
  } else {
    spus = await queryWithTenant<any>(
      `SELECT spu.id AS spuId, spu.name, spu.main_image AS mainImage, spu.description, spu.category_id AS categoryId, spu.status,
              spu.brand, spu.unit, spu.store_id AS storeId,
              cat.allow_online_sale AS allowOnlineSale
       FROM t_product_spu spu
       INNER JOIN t_product_category cat ON spu.category_id = cat.id
       WHERE spu.tenant_id = ?`,
      [tenantId],
      tenantId
    );
  }

  let syncedCount = 0;
  let skippedCount = 0;

  for (const spu of spus) {
    if (spu.allowOnlineSale === 0) {
      logger.info(`[小程序商品同步] 跳过禁止线上销售的商品 spuId=${spu.spuId}`);
      skippedCount++;
      continue;
    }

    const skus = await queryWithTenant<any>(
      "SELECT id AS skuId, price, cost_price AS costPrice, market_price AS marketPrice, stock_qty AS stockQty FROM t_product_sku WHERE spu_id = ? AND tenant_id = ?",
      [spu.spuId, tenantId],
      tenantId
    );

    const syncData = { spuId: spu.spuId, name: spu.name, mainImage: spu.mainImage, description: spu.description, categoryId: spu.categoryId, status: spu.status, brand: spu.brand, unit: spu.unit, storeId: spu.storeId, skus };

    await queryWithTenant(
      `INSERT INTO sync_cache (tenant_id, sync_type, entity_id, sync_data, sync_status)
       VALUES (?, 'product', ?, ?, 'synced')
       ON DUPLICATE KEY UPDATE sync_data = ?, sync_status = 'synced', updated_at = NOW()`,
      [tenantId, spu.spuId, JSON.stringify(syncData), JSON.stringify(syncData)],
      tenantId
    );
    syncedCount++;
  }

  return { syncedCount, skippedCount, totalCount: spus.length };
}