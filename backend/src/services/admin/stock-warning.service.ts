import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

// 获取预警列表
export async function getStockWarnings(tenantId: string, storeId?: number) {
  const storeCondition = storeId ? "AND ib.store_id = ?" : "";
  const params: unknown[] = [tenantId];
  if (storeId) params.push(storeId);

  return queryWithTenant<any>(
    `SELECT ib.sku_id AS skuId, ps.sku_name AS skuName,
            ib.store_id AS storeId, st.name AS storeName,
            ib.physical_qty AS currentStock,
            COALESCE(swc.min_qty, 0) AS minQty,
            COALESCE(swc.max_qty, 0) AS maxQty,
            CASE WHEN ib.physical_qty < COALESCE(swc.min_qty, 0) THEN 'LOW'
                 WHEN ib.physical_qty > COALESCE(swc.max_qty, 0) AND swc.max_qty > 0 THEN 'HIGH'
                 ELSE 'NORMAL' END AS warningLevel,
            ps.safety_stock AS safetyStock
     FROM t_inventory_balance ib
     JOIN t_product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
     LEFT JOIN store st ON st.id = ib.store_id
     LEFT JOIN stock_warning_config swc ON swc.sku_id = ib.sku_id AND swc.store_id = ib.store_id AND swc.tenant_id = ib.tenant_id AND swc.enabled = 1
     WHERE ib.tenant_id = ? ${storeCondition}
       AND (
         (swc.id IS NOT NULL AND (ib.physical_qty < swc.min_qty OR (swc.max_qty > 0 AND ib.physical_qty > swc.max_qty)))
         OR (swc.id IS NULL AND ib.physical_qty <= 5)
       )
     ORDER BY warningLevel, skuId`,
    params,
    tenantId
  );
}

// 批量配置预警阈值
export async function batchConfigStockWarning(params: {
  storeId: number; configs: { skuId: number; minQty: number; maxQty: number }[];
  tenantId: string;
}) {
  const { storeId, configs, tenantId } = params;
  for (const cfg of configs) {
    const existing = await queryOneWithTenant<any>(
      "SELECT id FROM stock_warning_config WHERE store_id = ? AND sku_id = ? AND tenant_id = ?",
      [storeId, cfg.skuId, tenantId],
      tenantId
    );
    if (existing) {
      await queryWithTenant(
        `UPDATE stock_warning_config SET min_qty = ?, max_qty = ?, enabled = 1 WHERE store_id = ? AND sku_id = ? AND tenant_id = ?`,
        [cfg.minQty, cfg.maxQty, storeId, cfg.skuId, tenantId],
        tenantId
      );
    } else {
      await queryWithTenant(
        `INSERT INTO stock_warning_config (store_id, sku_id, min_qty, max_qty, enabled, tenant_id)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [storeId, cfg.skuId, cfg.minQty, cfg.maxQty, tenantId],
        tenantId
      );
    }
  }
  return { storeId, configured: configs.length };
}

// 获取预警配置列表
export async function getStockWarningConfigs(tenantId: string, storeId?: number) {
  const conditions: string[] = ["swc.tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (storeId) { conditions.push("swc.store_id = ?"); params.push(storeId); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  return queryWithTenant<any>(
    `SELECT swc.id, swc.store_id AS storeId, st.name AS storeName,
            swc.sku_id AS skuId, ps.sku_name AS skuName,
            swc.min_qty AS minQty, swc.max_qty AS maxQty,
            swc.enabled, ib.physical_qty AS currentStock
     FROM stock_warning_config swc
     LEFT JOIN store st ON st.id = swc.store_id
     LEFT JOIN t_product_sku ps ON ps.id = swc.sku_id
     LEFT JOIN t_inventory_balance ib ON ib.sku_id = swc.sku_id AND ib.store_id = swc.store_id AND ib.tenant_id = swc.tenant_id
     ${where}
     ORDER BY swc.id`,
    params,
    tenantId
  );
}