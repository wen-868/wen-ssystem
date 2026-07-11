import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";
import logger from "../../shared/logger.js";

export async function listProductMappings(params: {
  platform: string; storeId?: number; tenantId: string;
  syncStatus?: string; page?: number; pageSize?: number;
}) {
  const { platform, storeId, tenantId, syncStatus, page = 1, pageSize = 20 } = params;
  const conditions = ["platform = ?", "tenant_id = ?"];
  const values: unknown[] = [platform, tenantId];
  if (storeId) { conditions.push("store_id = ?"); values.push(storeId); }
  if (syncStatus) { conditions.push("sync_status = ?"); values.push(syncStatus); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM platform_product_map ${where}`, values, tenantId);
  const rows = await queryWithTenant<any>(
    `SELECT * FROM platform_product_map ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize], tenantId
  );
  return { list: rows, total: Number(total?.cnt ?? 0), page, pageSize };
}

export async function addProductMapping(platform: string, storeId: number, localSkuId: number, tenantId: string) {
  await queryWithTenant(
    `INSERT INTO platform_product_map (platform, store_id, local_sku_id, sync_status, tenant_id) VALUES (?, ?, ?, 'UNSYNCED', ?)
     ON DUPLICATE KEY UPDATE sync_status = 'UNSYNCED'`,
    [platform, storeId, localSkuId, tenantId], tenantId
  );
}

export async function removeProductMapping(platform: string, storeId: number, localSkuId: number, tenantId: string) {
  await queryWithTenant(
    "DELETE FROM platform_product_map WHERE platform = ? AND store_id = ? AND local_sku_id = ? AND tenant_id = ?",
    [platform, storeId, localSkuId, tenantId], tenantId
  );
}

export async function updateMappingStatus(platform: string, localSkuId: number, status: string, platformSkuId?: string, platformSpuId?: string, syncMsg?: string, tenantId?: string) {
  const fields: string[] = ["sync_status = ?"];
  const values: unknown[] = [status];
  if (platformSkuId) { fields.push("platform_sku_id = ?"); values.push(platformSkuId); }
  if (platformSpuId) { fields.push("platform_spu_id = ?"); values.push(platformSpuId); }
  if (syncMsg) { fields.push("sync_msg = ?"); values.push(syncMsg); }
  if (status === "SYNCED" || status === "FAILED") { fields.push("synced_at = NOW()"); }
  values.push(platform, localSkuId);
  if (tenantId) { values.push(tenantId); }
  const tenantCondition = tenantId ? "AND tenant_id = ?" : "";
  await queryWithTenant(
    `UPDATE platform_product_map SET ${fields.join(", ")} WHERE platform = ? AND local_sku_id = ? ${tenantCondition}`,
    values, tenantId || ""
  );
}

export async function batchSyncProducts(platform: string, storeId: number, skuIds: number[], tenantId: string): Promise<{ synced: number; failed: number; skipped: number; total: number }> {
  let synced = 0, failed = 0, skipped = 0;
  for (const skuId of skuIds) {
    try {
      const allowOnline = await checkSkuAllowOnlineSale(skuId, tenantId);
      if (!allowOnline) {
        logger.info(`[即时零售同步] 跳过禁止线上销售的商品 skuId=${skuId} platform=${platform}`);
        await updateMappingStatus(platform, skuId, "SKIPPED", undefined, undefined, "商品分类禁止线上销售", tenantId);
        skipped++;
        continue;
      }
      await updateMappingStatus(platform, skuId, "PENDING", undefined, undefined, undefined, tenantId);
      await updateMappingStatus(platform, skuId, "SYNCED", `mock_sku_${skuId}`, `mock_spu_${skuId}`, "mock sync success", tenantId);
      synced++;
    } catch {
      await updateMappingStatus(platform, skuId, "FAILED", undefined, undefined, "同步失败", tenantId);
      failed++;
    }
  }
  return { synced, failed, skipped, total: skuIds.length };
}

async function checkSkuAllowOnlineSale(skuId: number, tenantId: string): Promise<boolean> {
  const row = await queryOneWithTenant<any>(
    `SELECT c.allow_online_sale
     FROM t_product_sku s
     INNER JOIN t_product_spu p ON s.spu_id = p.id
     INNER JOIN t_product_category c ON p.category_id = c.id
     WHERE s.id = ? AND s.tenant_id = ?`,
    [skuId, tenantId],
    tenantId
  );
  if (!row) return false;
  return row.allow_online_sale === 1;
}