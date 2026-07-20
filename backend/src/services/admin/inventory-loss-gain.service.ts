import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

// 报损/报溢
export async function reportLossGain(params: {
  storeId: number; type: string; skuId: number; qty: number;
  costPrice: number; reason: string; operatorId: number; tenantId: string;
}) {
  const { storeId, type, skuId, qty, costPrice, reason, operatorId, tenantId } = params;
  const lgNo = makeBizNo("SY");
  const amount = Math.round(qty * costPrice * 100) / 100;
  await queryWithTenant(
    `INSERT INTO t_inventory_loss_gain (lg_no, store_id, type, sku_id, qty, cost_price, amount, reason, operator_id, status, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
    [lgNo, storeId, type, skuId, qty, costPrice, amount, reason ?? null, operatorId, tenantId],
    tenantId
  );
  // 更新 inventory_balance
  const changeQty = type === "LOSS" ? -qty : qty;
  await queryWithTenant(
    `UPDATE t_inventory_balance SET physical_qty = GREATEST(physical_qty + ?, 0), available_qty = GREATEST(available_qty + ?, 0) WHERE store_id = ? AND sku_id = ? AND tenant_id = ?`,
    [changeQty, changeQty, storeId, skuId, tenantId],
    tenantId
  );
  // 写入 inventory_ledger
  await queryWithTenant(
    `INSERT INTO t_inventory_ledger (sku_id, store_id, change_type, change_qty, unit_price, amount, biz_no, biz_type, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [skuId, storeId, type === "LOSS" ? "OUT" : "IN", qty, costPrice, amount, lgNo, "LOSS_GAIN", tenantId],
    tenantId
  );
  return { lgNo, storeId, type, skuId, qty, amount };
}

// 损益列表
export async function listLossGains(params: {
  storeId?: number; type?: string; page: number; pageSize: number; tenantId: string;
}) {
  const { storeId, type, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["lg.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];
  if (storeId !== undefined) { conditions.push("lg.store_id = ?"); queryParams.push(storeId); }
  if (type) { conditions.push("lg.type = ?"); queryParams.push(type); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<any>(
    `SELECT lg.lg_no AS lgNo, lg.store_id AS storeId, st.name AS storeName,
            lg.type, lg.sku_id AS skuId, ps.sku_name AS skuName,
            lg.qty, lg.cost_price AS costPrice, lg.amount,
            lg.reason, lg.operator_id AS operatorId, lg.status, lg.created_at AS createdAt
     FROM t_inventory_loss_gain lg
     LEFT JOIN t_store st ON st.id = lg.store_id
     LEFT JOIN t_product_sku ps ON ps.id = lg.sku_id
     ${where}
     ORDER BY lg.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_inventory_loss_gain lg ${where}`,
    queryParams,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}