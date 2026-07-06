import { query, queryOne, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

export async function listInventory(params: {
  keyword: string; storeId: number | null | undefined; tenantId: string;
}) {
  const { keyword, storeId, tenantId } = params;
  const kw = `%${keyword}%`;
  const rows = await queryWithTenant<any>(
    `SELECT ib.store_id AS storeId, ib.sku_id AS skuId, s.sku_name AS skuName, ib.stock_type AS stockType,
            ib.physical_qty AS physicalQty, ib.locked_qty AS lockedQty, ib.available_qty AS availableQty
     FROM t_inventory_balance ib
     JOIN t_product_sku s ON s.id = ib.sku_id AND s.tenant_id = ib.tenant_id
     JOIN t_product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id
     WHERE ib.tenant_id = ?
       AND (? IS NULL OR ib.store_id = ?)
       AND (p.name LIKE ? OR s.sku_name LIKE ? OR s.sku_code LIKE ? OR s.barcode LIKE ?)
     ORDER BY ib.available_qty ASC, ib.updated_at DESC
     LIMIT 100`,
    [tenantId, storeId ?? null, storeId ?? null, kw, kw, kw, kw],
    tenantId
  );
  return rows;
}

export async function adjustInventory(params: {
  storeId: number; skuId: number; stockType: "ONLINE" | "OFFLINE";
  change: number; remark?: string; userId: number; tenantId: string;
}) {
  const { storeId, skuId, stockType, change, remark, userId, tenantId } = params;
  return transaction(async (conn) => {
    const [rows] = await conn.query<any[]>(
      `SELECT physical_qty AS physicalQty FROM t_inventory_balance WHERE store_id = ? AND sku_id = ? AND stock_type = ? AND tenant_id = ? FOR UPDATE`,
      [storeId, skuId, stockType, tenantId]
    );
    const beforeQty = Number(rows[0]?.physicalQty ?? 0);
    await conn.execute(
      `UPDATE t_inventory_balance SET physical_qty = physical_qty + ?, available_qty = available_qty + ?, updated_at = NOW() WHERE store_id = ? AND sku_id = ? AND stock_type = ? AND tenant_id = ?`,
      [change, change, storeId, skuId, stockType, tenantId]
    );
    const afterQty = beforeQty + change;
    await conn.execute(
      `INSERT INTO t_inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no, change_qty, before_qty, after_qty, before_locked_qty, after_locked_qty, operator_id, idempotency_key, remark, tenant_id) VALUES (?, ?, ?, ?, 'ADJUST', ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`,
      [makeBizNo("IL"), storeId, skuId, stockType, makeBizNo("ADJ"), change, beforeQty, afterQty, userId ?? null, makeBizNo("IDEMP"), remark ?? "门店调整", tenantId]
    );
    return { ok: true };
  });
}

export async function listInventoryLogs(params: {
  page: number; pageSize: number; storeId: number | null | undefined; tenantId: string;
}) {
  const { page, pageSize, storeId, tenantId } = params;
  const offset = (page - 1) * pageSize;
  let sql = `SELECT il.ledger_no AS logNo, il.store_id AS storeId, il.sku_id AS skuId, ps.sku_name AS skuName, il.change_qty AS changeQty, il.before_qty AS beforeQty, il.after_qty AS afterQty, il.remark AS reason, il.operator_id AS operatorId, il.created_at AS createdAt FROM t_inventory_ledger il LEFT JOIN t_product_sku ps ON ps.id = il.sku_id AND ps.tenant_id = il.tenant_id WHERE il.tenant_id = ?`;
  const paramsArr: unknown[] = [tenantId];
  if (storeId) { sql += " AND il.store_id = ?"; paramsArr.push(storeId); }
  sql += " ORDER BY il.created_at DESC LIMIT ? OFFSET ?";
  paramsArr.push(pageSize, offset);
  const records = await queryWithTenant<any>(sql, paramsArr, tenantId);
  const totalSql = storeId ? "SELECT COUNT(*) AS total FROM t_inventory_ledger WHERE tenant_id = ? AND store_id = ?" : "SELECT COUNT(*) AS total FROM t_inventory_ledger WHERE tenant_id = ?";
  const totalRow = await queryOneWithTenant<any>(totalSql, storeId ? [tenantId, storeId] : [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listInventoryAlerts(storeId: number | null, tenantId: string) {
  const where = storeId ? "WHERE ib.tenant_id = ? AND ib.store_id = ?" : "WHERE ib.tenant_id = ?";
  const params = storeId ? [tenantId, storeId] : [tenantId];
  return queryWithTenant<any>(
    `SELECT ib.sku_id AS skuId, ps.sku_name AS skuName, ib.stock_type AS stockType, ib.available_qty AS availableQty FROM t_inventory_balance ib LEFT JOIN t_product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id ${where} AND ib.available_qty <= 5 ORDER BY ib.available_qty ASC LIMIT 20`,
    params,
    tenantId
  );
}