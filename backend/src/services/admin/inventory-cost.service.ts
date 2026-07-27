﻿﻿﻿import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

// ===== 类型定义 =====
/** SKU 成本价查询行 */
interface SkuCostPriceRow {
  costPrice: number | string | null;
  id: number | string;
}

/** 库存实物数量查询行 */
interface InventoryPhysicalQtyRow {
  physicalQty: number | string;
}

/** 成本明细查询行 */
interface InventoryCostDetailRow {
  skuId: number | string;
  skuName: string;
  movingAvgCost: number | string | null;
  endingQty: number | string;
  inQty: number | string;
  inAmount: number | string;
  outQty: number | string;
  outAmount: number | string;
}

/** 成本趋势查询行 */
interface InventoryCostTrendRow {
  date: string | Date;
  skuId: number | string;
  unitPrice: number | string | null;
  changeType: string;
  changeQty: number | string;
}

// 移动加权平均成本核算（入库时调用）
export async function updateMovingAverageCost(params: {
  skuId: number; inQty: number; inUnitPrice: number; tenantId: string;
}) {
  const { skuId, inQty, inUnitPrice, tenantId } = params;
  const sku = await queryOneWithTenant<SkuCostPriceRow>(
    "SELECT cost_price AS costPrice, id FROM t_product_sku WHERE id = ? AND tenant_id = ?",
    [skuId, tenantId],
    tenantId
  );
  const existingCost = Number(sku?.costPrice ?? 0);
  const inv = await queryOneWithTenant<InventoryPhysicalQtyRow>(
    "SELECT physical_qty AS physicalQty FROM t_inventory_balance WHERE sku_id = ? AND tenant_id = ? LIMIT 1",
    [skuId, tenantId],
    tenantId
  );
  const existingQty = Number(inv?.physicalQty ?? 0);
  const totalQty = existingQty + inQty;
  let newCost = existingCost;
  if (totalQty > 0) {
    newCost = Math.round((existingQty * existingCost + inQty * inUnitPrice) / totalQty * 100) / 100;
  }
  await queryWithTenant(
    "UPDATE t_product_sku SET cost_price = ? WHERE id = ? AND tenant_id = ?",
    [newCost, skuId, tenantId],
    tenantId
  );
  return { skuId, oldCost: existingCost, newCost, inQty, inUnitPrice };
}

// 成本明细
export async function getInventoryCostDetail(tenantId: string, startDate?: string, endDate?: string) {
  const conditions: string[] = ["ps.tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (startDate) { conditions.push("il.created_at >= ?"); params.push(startDate); }
  if (endDate) { conditions.push("il.created_at <= ?"); params.push(endDate); }
  const where = conditions.length > 1 ? `AND ${conditions.slice(1).join(" AND ")}` : "";
  return queryWithTenant<InventoryCostDetailRow>(
    `SELECT ps.id AS skuId, ps.sku_name AS skuName, ps.cost_price AS movingAvgCost,
            COALESCE(ib.physical_qty, 0) AS endingQty,
            COALESCE(SUM(CASE WHEN il.change_type = 'IN' THEN il.change_qty ELSE 0 END), 0) AS inQty,
            COALESCE(SUM(CASE WHEN il.change_type = 'IN' THEN il.change_qty * il.unit_price ELSE 0 END), 0) AS inAmount,
            COALESCE(SUM(CASE WHEN il.change_type = 'OUT' THEN il.change_qty ELSE 0 END), 0) AS outQty,
            COALESCE(SUM(CASE WHEN il.change_type = 'OUT' THEN il.change_qty * il.unit_price ELSE 0 END), 0) AS outAmount
     FROM t_product_sku ps
     LEFT JOIN t_inventory_balance ib ON ib.sku_id = ps.id AND ib.tenant_id = ps.tenant_id
     LEFT JOIN t_inventory_ledger il ON il.sku_id = ps.id AND il.tenant_id = ps.tenant_id ${where}
     WHERE ps.tenant_id = ?
     GROUP BY ps.id, ps.sku_name, ps.cost_price, ib.physical_qty
     ORDER BY endingQty DESC`,
    [...params, tenantId],
    tenantId
  );
}

// 成本趋势
export async function getInventoryCostTrend(tenantId: string, skuId?: number) {
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (skuId) { conditions.push("sku_id = ?"); params.push(skuId); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  return queryWithTenant<InventoryCostTrendRow>(
    `SELECT DATE(created_at) AS date, sku_id AS skuId, unit_price AS unitPrice,
            change_type AS changeType, change_qty AS changeQty
     FROM t_inventory_ledger ${where}
     ORDER BY created_at ASC
     LIMIT 500`,
    params,
    tenantId
  );
}