import { query, queryOne, queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

export async function getDashboard(tenantId: string) {
  const sales = await queryOneWithTenant<any>("SELECT COALESCE(SUM(received_amount),0) AS amount, COUNT(*) AS count FROM sale_bill WHERE DATE(created_at)=CURRENT_DATE AND tenant_id = ?", [tenantId], tenantId);
  const pending = await queryOneWithTenant<any>("SELECT COALESCE(SUM(unreceived_amount),0) AS amount FROM sale_bill WHERE collection_status IN ('UNPAID','PENDING','SHARED','PARTIAL') AND tenant_id = ?", [tenantId], tenantId);
  const orders = await queryOneWithTenant<any>("SELECT COUNT(*) AS count FROM miniapp_order WHERE DATE(created_at)=CURRENT_DATE AND tenant_id = ?", [tenantId], tenantId);
  const warnings = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS count
     FROM inventory_balance ib
     JOIN product_sku s ON s.id = ib.sku_id
     WHERE ib.available_qty <= s.warning_threshold AND ib.tenant_id = ?`,
    [tenantId],
    tenantId
  );
  const pendingOrders = await queryOneWithTenant<any>(
    "SELECT COUNT(*) AS cnt FROM miniapp_order WHERE order_status = 'PENDING_PAYMENT' AND tenant_id = ?",
    [tenantId],
    tenantId
  );
  return {
    salesAmount: Number(sales?.amount ?? 0),
    orderCount: Number(orders?.count ?? 0),
    saleBillCount: Number(sales?.count ?? 0),
    pendingCollectionAmount: Number(pending?.amount ?? 0),
    inventoryWarningCount: Number(warnings?.count ?? 0),
    pendingOrderCount: Number(pendingOrders?.cnt ?? 0)
  };
}

export async function getDailySalesTrend(tenantId: string) {
  const records = await queryWithTenant<any>(
    `SELECT DATE(created_at) AS date,
            COUNT(DISTINCT bill_no) AS count,
            COALESCE(SUM(receivable_amount), 0) AS amount
     FROM sale_bill
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND tenant_id = ?
     GROUP BY DATE(created_at)
     ORDER BY date`,
    [tenantId],
    tenantId
  );
  return records;
}

export async function getStoreSalesPerformance(tenantId: string) {
  const records = await queryWithTenant<any>(
    `SELECT s.id AS storeId, s.name AS storeName,
            COALESCE(SUM(sb.receivable_amount), 0) AS totalSales,
            COUNT(DISTINCT sb.bill_no) AS billCount
     FROM store s
     LEFT JOIN sale_bill sb ON sb.store_id = s.id AND sb.tenant_id = ?
     WHERE s.tenant_id = ?
     GROUP BY s.id, s.name`,
    [tenantId, tenantId],
    tenantId
  );
  return records;
}

export async function getInventoryAlerts(tenantId: string) {
  const records = await queryWithTenant<any>(
    `SELECT ib.store_id AS storeId, s.name AS storeName,
            ib.sku_id AS skuId, ps.sku_name AS skuName,
            ib.stock_type AS stockType, ib.available_qty AS availableQty
     FROM inventory_balance ib
     LEFT JOIN store s ON s.id = ib.store_id
     LEFT JOIN product_sku ps ON ps.id = ib.sku_id
     WHERE ib.tenant_id = ? AND ib.available_qty <= 5
     ORDER BY ib.available_qty ASC, ib.store_id`,
    [tenantId],
    tenantId
  );
  return records;
}

export async function listInventoryBalance(
  tenantId: string,
  page: number,
  pageSize: number,
  keyword: string,
  storeId?: number,
  category?: number
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["ib.tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (keyword) {
    const kw = `%${keyword}%`;
    conditions.push("(ps.sku_name LIKE ? OR ps.sku_code LIKE ? OR ps.barcode LIKE ?)");
    params.push(kw, kw, kw);
  }
  if (storeId !== undefined) {
    conditions.push("ib.store_id = ?");
    params.push(storeId);
  }
  if (category !== undefined) {
    conditions.push("psp.category_id = ?");
    params.push(category);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<any>(
    `SELECT ib.store_id AS storeId, s.name AS storeName, ib.sku_id AS skuId,
            ps.sku_name AS skuName, ps.barcode, ib.stock_type AS stockType,
            ib.physical_qty AS physicalQty, ib.available_qty AS availableQty,
            ib.locked_qty AS lockedQty
     FROM inventory_balance ib
     LEFT JOIN store s ON s.id = ib.store_id
     LEFT JOIN product_sku ps ON ps.id = ib.sku_id
     LEFT JOIN product_spu psp ON psp.id = ps.spu_id
     ${where}
     ORDER BY ib.store_id, ib.sku_id
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total
     FROM inventory_balance ib
     LEFT JOIN product_sku ps ON ps.id = ib.sku_id
     LEFT JOIN product_spu psp ON psp.id = ps.spu_id
     ${where}`,
    params,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listInventoryLogs(tenantId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<any>(
    `SELECT il.ledger_no AS logNo, il.store_id AS storeId, il.sku_id AS skuId,
            ps.sku_name AS skuName, il.change_qty AS changeQty,
            il.before_qty AS beforeQty, il.after_qty AS afterQty,
            il.remark AS reason, il.operator_id AS operatorId, il.created_at AS createdAt
     FROM inventory_ledger il
     LEFT JOIN product_sku ps ON ps.id = il.sku_id
     WHERE il.tenant_id = ?
     ORDER BY il.created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>("SELECT COUNT(*) AS total FROM inventory_ledger WHERE tenant_id = ?", [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listCollectionLinks(tenantId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<any>(
    `SELECT cl.link_no AS linkNo, cl.source_type AS sourceType, cl.source_no AS sourceNo,
            cl.amount, cl.paid_amount AS paidAmount, cl.status,
            cl.share_channel AS shareChannel, cl.token,
            cl.expire_at AS expireAt, cl.created_at AS createdAt
     FROM collection_link cl
     WHERE cl.tenant_id = ?
     ORDER BY cl.created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>("SELECT COUNT(*) AS total FROM collection_link WHERE tenant_id = ?", [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listPaymentOrders(tenantId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<any>(
    `SELECT pay_no AS payNo, source_type AS sourceType, source_no AS sourceNo,
            amount, status, channel AS paymentMethod,
            paid_at AS paidAt, created_at AS createdAt
     FROM payment_order
     WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>("SELECT COUNT(*) AS total FROM payment_order WHERE tenant_id = ?", [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listRefundOrders(tenantId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<any>(
    `SELECT refund_no AS refundNo, pay_no AS payNo, source_type AS sourceType,
            source_no AS sourceNo, amount, reason, status, created_at AS createdAt
     FROM refund_order
     WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<any>("SELECT COUNT(*) AS total FROM refund_order WHERE tenant_id = ?", [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}