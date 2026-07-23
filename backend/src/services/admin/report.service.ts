import { query, queryOne, queryWithTenant, queryOneWithTenant } from "../../shared/db";

// ========== 数据库行类型定义 ==========
/** 仪表盘销售汇总行（amount + count） */
interface DashboardSalesRow {
  amount: number | string;
  count: number | string;
}

/** COALESCE(SUM(...), 0) AS amount 结果行 */
interface AmountRow {
  amount: number | string;
}

/** COUNT(*) AS count 结果行 */
interface CountAsCountRow {
  count: number | string;
}

/** COUNT(*) AS cnt 结果行 */
interface CntRow {
  cnt: number | string;
}

/** COUNT(*) AS total 结果行 */
interface CountTotalRow {
  total: number;
}

/** 每日销售趋势行 */
interface DailySalesTrendRow {
  date: string | Date;
  count: number | string;
  amount: number | string;
}

/** 门店销售业绩行 */
interface StoreSalesRow {
  storeId: number | string;
  storeName: string | null;
  totalSales: number | string;
  billCount: number | string;
}

/** 库存预警行 */
interface InventoryAlertRow {
  storeId: number | string;
  storeName: string | null;
  skuId: number | string;
  skuName: string | null;
  stockType: string;
  availableQty: number | string;
}

/** 库存余额列表行 */
interface InventoryBalanceRow {
  storeId: number | string;
  storeName: string | null;
  skuId: number | string;
  skuName: string | null;
  barcode: string | null;
  stockType: string;
  physicalQty: number | string;
  availableQty: number | string;
  lockedQty: number | string;
}

/** 库存日志行 */
interface InventoryLogRow {
  logNo: string;
  storeId: number | string;
  skuId: number | string;
  skuName: string | null;
  changeQty: number | string;
  beforeQty: number | string;
  afterQty: number | string;
  reason: string | null;
  operatorId: number | string | null;
  createdAt: string | Date;
}

/** 收款链接列表行 */
interface CollectionLinkRow {
  linkNo: string;
  sourceType: string;
  sourceNo: string;
  amount: number | string;
  paidAmount: number | string;
  status: string;
  shareChannel: string | null;
  token: string | null;
  expireAt: string | Date | null;
  createdAt: string | Date;
}

/** 支付订单列表行 */
interface PaymentOrderRow {
  payNo: string;
  sourceType: string;
  sourceNo: string;
  amount: number | string;
  status: string;
  paymentMethod: string | null;
  paidAt: string | Date | null;
  createdAt: string | Date;
}

/** 退款订单列表行 */
interface RefundOrderRow {
  refundNo: string;
  payNo: string;
  sourceType: string;
  sourceNo: string;
  amount: number | string;
  reason: string | null;
  status: string;
  createdAt: string | Date;
}

/** 渠道统计行 */
interface ChannelCountRow {
  channel: string | null;
  cnt: number | string;
}

/** 收款链接状态行（link_no + status） */
interface CollectionLinkStatusRow {
  link_no: string;
  status: string;
}

/** 销售排行行 */
interface SalesRankingRow {
  staffId: number | string | null;
  staffName: string;
  orderCount: number | string;
  totalSales: number | string;
  totalReceived: number | string;
}

/** 产品排行行 */
interface ProductRankingRow {
  skuId: number | string;
  skuName: string | null;
  totalQty: number | string;
  totalSales: number | string;
}

/** 销售趋势行 */
interface SalesTrendRow {
  period: string;
  count: number | string;
  amount: number | string;
}

/** 采购汇总行 */
interface PurchaseSummaryRow {
  totalPurchaseAmount: number | string;
  orderCount: number | string;
  supplierCount: number | string;
}

/** 供应商采购行（含排行，复用） */
interface SupplierPurchaseRow {
  supplierId: number | string;
  supplierName: string | null;
  totalAmount: number | string;
  orderCount: number | string;
}

/** 采购趋势行 */
interface PurchaseTrendRow {
  period: string;
  orderCount: number | string;
  totalAmount: number | string;
}

/** 库存周转行 */
interface InventoryTurnoverRow {
  skuId: number | string;
  skuName: string | null;
  outQty: number | string;
  avgStock: number | string;
  turnoverRate: number | string;
  turnoverDays: number | string;
}

/** 库存库龄行 */
interface InventoryAgeRow {
  skuId: number | string;
  skuName: string | null;
  totalQty: number | string;
  storeId: number | string;
  storeName: string | null;
  batchNo: string | null;
  productionDate: string | Date | null;
  batchQty: number | string;
  ageDays: number | string;
  ageGroup: string;
}

/** 库存 ABC 分析行 */
interface InventoryABCRow {
  skuId: number | string;
  skuName: string | null;
  totalSales: number | string;
}

export async function getDashboard(tenantId: string) {
  const sales = await queryOneWithTenant<DashboardSalesRow>("SELECT COALESCE(SUM(received_amount),0) AS amount, COUNT(*) AS count FROM t_sale_bill WHERE DATE(created_at)=CURRENT_DATE AND tenant_id = ?", [tenantId], tenantId);
  const pending = await queryOneWithTenant<AmountRow>("SELECT COALESCE(SUM(unreceived_amount),0) AS amount FROM t_sale_bill WHERE collection_status IN ('UNPAID','PENDING','SHARED','PARTIAL') AND tenant_id = ?", [tenantId], tenantId);
  const orders = await queryOneWithTenant<CountAsCountRow>("SELECT COUNT(*) AS count FROM t_miniapp_order WHERE DATE(created_at)=CURRENT_DATE AND tenant_id = ?", [tenantId], tenantId);
  const warnings = await queryOneWithTenant<CountAsCountRow>(
    `SELECT COUNT(*) AS count
     FROM t_inventory_balance ib
     JOIN t_product_sku s ON s.id = ib.sku_id
     WHERE ib.available_qty <= s.warning_threshold AND ib.tenant_id = ?`,
    [tenantId],
    tenantId
  );
  const pendingOrders = await queryOneWithTenant<CntRow>(
    "SELECT COUNT(*) AS cnt FROM t_miniapp_order WHERE order_status = 'PENDING_PAYMENT' AND tenant_id = ?",
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
  const records = await queryWithTenant<DailySalesTrendRow>(
    `SELECT DATE(created_at) AS date,
            COUNT(DISTINCT bill_no) AS count,
            COALESCE(SUM(receivable_amount), 0) AS amount
     FROM t_sale_bill
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND tenant_id = ?
     GROUP BY DATE(created_at)
     ORDER BY date`,
    [tenantId],
    tenantId
  );
  return records;
}

export async function getStoreSalesPerformance(tenantId: string) {
  const records = await queryWithTenant<StoreSalesRow>(
    `SELECT s.id AS storeId, s.name AS storeName,
            COALESCE(SUM(sb.receivable_amount), 0) AS totalSales,
            COUNT(DISTINCT sb.bill_no) AS billCount
     FROM t_store s
     LEFT JOIN t_sale_bill sb ON sb.store_id = s.id AND sb.tenant_id = ?
     WHERE s.tenant_id = ?
     GROUP BY s.id, s.name`,
    [tenantId, tenantId],
    tenantId
  );
  return records;
}

export async function getInventoryAlerts(tenantId: string) {
  const records = await queryWithTenant<InventoryAlertRow>(
    `SELECT ib.store_id AS storeId, s.name AS storeName,
            ib.sku_id AS skuId, ps.sku_name AS skuName,
            ib.stock_type AS stockType, ib.available_qty AS availableQty
     FROM t_inventory_balance ib
     LEFT JOIN t_store s ON s.id = ib.store_id
     LEFT JOIN t_product_sku ps ON ps.id = ib.sku_id
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
  const records = await queryWithTenant<InventoryBalanceRow>(
    `SELECT ib.store_id AS storeId, s.name AS storeName, ib.sku_id AS skuId,
            ps.sku_name AS skuName, ps.barcode, ib.stock_type AS stockType,
            ib.physical_qty AS physicalQty, ib.available_qty AS availableQty,
            ib.locked_qty AS lockedQty
     FROM t_inventory_balance ib
     LEFT JOIN t_store s ON s.id = ib.store_id
     LEFT JOIN t_product_sku ps ON ps.id = ib.sku_id
     LEFT JOIN t_product_spu psp ON psp.id = ps.spu_id
     ${where}
     ORDER BY ib.store_id, ib.sku_id
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total
     FROM t_inventory_balance ib
     LEFT JOIN t_product_sku ps ON ps.id = ib.sku_id
     LEFT JOIN t_product_spu psp ON psp.id = ps.spu_id
     ${where}`,
    params,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listInventoryLogs(tenantId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<InventoryLogRow>(
    `SELECT il.ledger_no AS logNo, il.store_id AS storeId, il.sku_id AS skuId,
            ps.sku_name AS skuName, il.change_qty AS changeQty,
            il.before_qty AS beforeQty, il.after_qty AS afterQty,
            il.remark AS reason, il.operator_id AS operatorId, il.created_at AS createdAt
     FROM t_inventory_ledger il
     LEFT JOIN t_product_sku ps ON ps.id = il.sku_id
     WHERE il.tenant_id = ?
     ORDER BY il.created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>("SELECT COUNT(*) AS total FROM t_inventory_ledger WHERE tenant_id = ?", [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listCollectionLinks(tenantId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<CollectionLinkRow>(
    `SELECT cl.link_no AS linkNo, cl.source_type AS sourceType, cl.source_no AS sourceNo,
            cl.amount, cl.paid_amount AS paidAmount, cl.status,
            cl.share_channel AS shareChannel, cl.token,
            cl.expire_at AS expireAt, cl.created_at AS createdAt
     FROM t_collection_link cl
     WHERE cl.tenant_id = ?
     ORDER BY cl.created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>("SELECT COUNT(*) AS total FROM t_collection_link WHERE tenant_id = ?", [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listPaymentOrders(tenantId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<PaymentOrderRow>(
    `SELECT pay_no AS payNo, source_type AS sourceType, source_no AS sourceNo,
            amount, status, channel AS paymentMethod,
            paid_at AS paidAt, created_at AS createdAt
     FROM t_payment_order
     WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>("SELECT COUNT(*) AS total FROM t_payment_order WHERE tenant_id = ?", [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

export async function listRefundOrders(tenantId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<RefundOrderRow>(
    `SELECT refund_no AS refundNo, pay_no AS payNo, source_type AS sourceType,
            source_no AS sourceNo, amount, reason, status, created_at AS createdAt
     FROM t_refund_order
     WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>("SELECT COUNT(*) AS total FROM t_refund_order WHERE tenant_id = ?", [tenantId], tenantId);
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}

// ============ 分享链接管理 ============

export async function getCollectionLinkStats(tenantId: string) {
  const total = await queryOneWithTenant<CountTotalRow>("SELECT COUNT(*) AS total FROM t_collection_link WHERE tenant_id = ?", [tenantId], tenantId);
  const paid = await queryOneWithTenant<CntRow>("SELECT COUNT(*) AS cnt FROM t_collection_link WHERE tenant_id = ? AND status = 'PAID'", [tenantId], tenantId);
  const revoked = await queryOneWithTenant<CntRow>("SELECT COUNT(*) AS cnt FROM t_collection_link WHERE tenant_id = ? AND status = 'REVOKED'", [tenantId], tenantId);
  const channels = await queryWithTenant<ChannelCountRow>(
    `SELECT share_channel AS channel, COUNT(*) AS cnt FROM t_collection_link WHERE tenant_id = ? GROUP BY share_channel`,
    [tenantId], tenantId
  );
  const totalAmount = await queryOneWithTenant<AmountRow>("SELECT COALESCE(SUM(paid_amount),0) AS amount FROM t_collection_link WHERE tenant_id = ?", [tenantId], tenantId);
  return {
    total: total?.total ?? 0,
    paidCount: paid?.cnt ?? 0,
    revokedCount: revoked?.cnt ?? 0,
    totalPaidAmount: totalAmount?.amount ?? 0,
    paymentRate: total && Number(total.total) > 0 ? (Number(paid?.cnt ?? 0) / Number(total.total) * 100).toFixed(1) + "%" : "0%",
    channels
  };
}

export async function revokeCollectionLink(linkNo: string, tenantId: string) {
  const link = await queryOneWithTenant<CollectionLinkStatusRow>("SELECT link_no, status FROM t_collection_link WHERE link_no = ? AND tenant_id = ?", [linkNo, tenantId], tenantId);
  if (!link) throw new Error("分享链接不存在");
  if (link.status === "REVOKED") throw new Error("链接已撤销");
  if (link.status === "PAID") throw new Error("已支付的链接不可撤销");
  await queryWithTenant("UPDATE t_collection_link SET status = 'REVOKED' WHERE link_no = ? AND tenant_id = ?", [linkNo, tenantId], tenantId);
  return { linkNo, status: "REVOKED" };
}

// ============ 销售报表 ============

export async function getSalesRanking(tenantId: string, startDate?: string, endDate?: string) {
  let dateFilter = "";
  const params: unknown[] = [tenantId];
  if (startDate) { dateFilter += " AND sb.created_at >= ?"; params.push(startDate); }
  if (endDate) { dateFilter += " AND sb.created_at < DATE_ADD(?, INTERVAL 1 DAY)"; params.push(endDate); }
  const records = await queryWithTenant<SalesRankingRow>(
    `SELECT sb.operator_id AS staffId, COALESCE(e.name, '未知') AS staffName,
            COUNT(DISTINCT sb.bill_no) AS orderCount,
            COALESCE(SUM(sb.receivable_amount), 0) AS totalSales,
            COALESCE(SUM(sb.received_amount), 0) AS totalReceived
     FROM t_sale_bill sb
     LEFT JOIN t_employee e ON e.id = sb.operator_id
     WHERE sb.tenant_id = ?${dateFilter}
     GROUP BY sb.operator_id, e.name
     ORDER BY totalSales DESC`,
    params, tenantId
  );
  return records;
}

export async function getProductRanking(tenantId: string, startDate?: string, endDate?: string) {
  let dateFilter = "";
  const params: unknown[] = [tenantId];
  if (startDate) { dateFilter += " AND sb.created_at >= ?"; params.push(startDate); }
  if (endDate) { dateFilter += " AND sb.created_at < DATE_ADD(?, INTERVAL 1 DAY)"; params.push(endDate); }
  const records = await queryWithTenant<ProductRankingRow>(
    `SELECT sbi.sku_id AS skuId, sbi.sku_name AS skuName,
            COALESCE(SUM(sbi.total_bottle_qty), 0) AS totalQty,
            COALESCE(SUM(sbi.subtotal_amount), 0) AS totalSales
     FROM t_sale_bill_item sbi
     JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no
     WHERE sb.tenant_id = ?${dateFilter}
     GROUP BY sbi.sku_id, sbi.sku_name
     ORDER BY totalSales DESC
     LIMIT 50`,
    params, tenantId
  );
  return records;
}

export async function getSalesTrend(tenantId: string, groupBy: string = "day", startDate?: string, endDate?: string) {
  let dateFilter = "";
  const params: unknown[] = [tenantId];
  if (startDate) { dateFilter += " AND sb.created_at >= ?"; params.push(startDate); }
  if (endDate) { dateFilter += " AND sb.created_at < DATE_ADD(?, INTERVAL 1 DAY)"; params.push(endDate); }
  let format = "%Y-%m-%d";
  if (groupBy === "week") format = "%Y-%u";
  if (groupBy === "month") format = "%Y-%m";
  const records = await queryWithTenant<SalesTrendRow>(
    `SELECT DATE_FORMAT(sb.created_at, ?) AS period,
            COUNT(DISTINCT sb.bill_no) AS count,
            COALESCE(SUM(sb.receivable_amount), 0) AS amount
     FROM t_sale_bill sb
     WHERE sb.tenant_id = ?${dateFilter}
     GROUP BY period ORDER BY period`,
    [format, ...params], tenantId
  );
  return records;
}

// ============ 采购报表 ============

export async function getPurchaseSummary(tenantId: string, startDate?: string, endDate?: string) {
  const conditions: string[] = ["po.tenant_id = ?", "po.order_status NOT IN ('VOIDED')"];
  const params: unknown[] = [tenantId];
  if (startDate) { conditions.push("po.created_at >= ?"); params.push(startDate); }
  if (endDate) { conditions.push("po.created_at <= ?"); params.push(endDate); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const summary = await queryOneWithTenant<PurchaseSummaryRow>(
    `SELECT COALESCE(SUM(po.goods_amount), 0) AS totalPurchaseAmount,
            COUNT(DISTINCT po.order_no) AS orderCount,
            COUNT(DISTINCT po.supplier_id) AS supplierCount
     FROM t_purchase_order po ${where}`,
    params, tenantId
  );
  const bySupplier = await queryWithTenant<SupplierPurchaseRow>(
    `SELECT po.supplier_id AS supplierId, s.name AS supplierName,
            COALESCE(SUM(po.goods_amount), 0) AS totalAmount,
            COUNT(DISTINCT po.order_no) AS orderCount
     FROM t_purchase_order po
     LEFT JOIN t_supplier s ON s.id = po.supplier_id
     ${where}
     GROUP BY po.supplier_id, s.name
     ORDER BY totalAmount DESC`,
    params, tenantId
  );
  return { summary, bySupplier };
}

export async function getPurchaseTrend(tenantId: string, groupBy: string = "day", startDate?: string, endDate?: string) {
  const conditions: string[] = ["tenant_id = ?", "order_status NOT IN ('VOIDED')"];
  const params: unknown[] = [tenantId];
  if (startDate) { conditions.push("created_at >= ?"); params.push(startDate); }
  if (endDate) { conditions.push("created_at <= ?"); params.push(endDate); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  let dateFormat: string;
  if (groupBy === "month") {
    dateFormat = "DATE_FORMAT(created_at, '%Y-%m')";
  } else if (groupBy === "week") {
    dateFormat = "DATE_FORMAT(created_at, '%Y-%u')";
  } else {
    dateFormat = "DATE(created_at)";
  }
  return queryWithTenant<PurchaseTrendRow>(
    `SELECT ${dateFormat} AS period,
            COUNT(DISTINCT order_no) AS orderCount,
            COALESCE(SUM(goods_amount), 0) AS totalAmount
     FROM t_purchase_order ${where}
     GROUP BY period
     ORDER BY period`,
    params, tenantId
  );
}

export async function getSupplierRanking(tenantId: string, startDate?: string, endDate?: string) {
  const conditions: string[] = ["po.tenant_id = ?", "po.order_status NOT IN ('VOIDED')"];
  const params: unknown[] = [tenantId];
  if (startDate) { conditions.push("po.created_at >= ?"); params.push(startDate); }
  if (endDate) { conditions.push("po.created_at <= ?"); params.push(endDate); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  return queryWithTenant<SupplierPurchaseRow>(
    `SELECT po.supplier_id AS supplierId, s.name AS supplierName,
            COALESCE(SUM(po.goods_amount), 0) AS totalAmount,
            COUNT(DISTINCT po.order_no) AS orderCount
     FROM t_purchase_order po
     LEFT JOIN t_supplier s ON s.id = po.supplier_id
     ${where}
     GROUP BY po.supplier_id, s.name
     ORDER BY totalAmount DESC`,
    params, tenantId
  );
}
// ============ 库存报表 ============

export async function getInventoryTurnover(tenantId: string, startDate?: string, endDate?: string) {
  const conditions: string[] = ["il.tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (startDate) { conditions.push("il.created_at >= ?"); params.push(startDate); }
  if (endDate) { conditions.push("il.created_at <= ?"); params.push(endDate); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  return queryWithTenant<InventoryTurnoverRow>(
    `SELECT il.sku_id AS skuId, ps.sku_name AS skuName,
            COALESCE(SUM(CASE WHEN il.change_type = 'OUT' THEN ABS(il.change_qty) ELSE 0 END), 0) AS outQty,
            COALESCE(AVG(ib.physical_qty), 0) AS avgStock,
            CASE WHEN COALESCE(AVG(ib.physical_qty), 0) > 0
                 THEN ROUND(COALESCE(SUM(CASE WHEN il.change_type = 'OUT' THEN ABS(il.change_qty) ELSE 0 END), 0) / AVG(ib.physical_qty), 2)
                 ELSE 0 END AS turnoverRate,
            CASE WHEN COALESCE(SUM(CASE WHEN il.change_type = 'OUT' THEN ABS(il.change_qty) ELSE 0 END), 0) > 0
                 THEN ROUND(30 / (COALESCE(SUM(CASE WHEN il.change_type = 'OUT' THEN ABS(il.change_qty) ELSE 0 END), 0) / GREATEST(AVG(ib.physical_qty), 1)), 1)
                 ELSE 0 END AS turnoverDays
     FROM t_inventory_ledger il
     JOIN t_product_sku ps ON ps.id = il.sku_id AND ps.tenant_id = il.tenant_id
     LEFT JOIN t_inventory_balance ib ON ib.sku_id = il.sku_id AND ib.tenant_id = il.tenant_id
     ${where}
     GROUP BY il.sku_id, ps.sku_name
     ORDER BY turnoverRate DESC`,
    params, tenantId
  );
}

export async function getInventoryAge(tenantId: string, storeId?: number) {
  const storeCondition = storeId ? "AND ib.store_id = ?" : "";
  const params: unknown[] = [tenantId];
  if (storeId) params.push(storeId);
  return queryWithTenant<InventoryAgeRow>(
    `SELECT ib.sku_id AS skuId, ps.sku_name AS skuName,
            ib.physical_qty AS totalQty, ib.store_id AS storeId,
            st.name AS storeName,
            ibat.batch_no AS batchNo, ibat.production_date AS productionDate,
            COALESCE(ibat.bottle_qty, 0) AS batchQty,
            DATEDIFF(NOW(), COALESCE(ibat.production_date, ibat.created_at)) AS ageDays,
            CASE WHEN DATEDIFF(NOW(), COALESCE(ibat.production_date, ibat.created_at)) <= 30 THEN '0-30天'
                 WHEN DATEDIFF(NOW(), COALESCE(ibat.production_date, ibat.created_at)) <= 60 THEN '30-60天'
                 WHEN DATEDIFF(NOW(), COALESCE(ibat.production_date, ibat.created_at)) <= 90 THEN '60-90天'
                 ELSE '90天以上' END AS ageGroup
     FROM t_inventory_balance ib
     JOIN t_product_sku ps ON ps.id = ib.sku_id
     LEFT JOIN t_store st ON st.id = ib.store_id
     LEFT JOIN t_inventory_batch ibat ON ibat.sku_id = ib.sku_id AND ibat.tenant_id = ib.tenant_id
     WHERE ib.tenant_id = ? ${storeCondition} AND ib.physical_qty > 0
     ORDER BY ageDays DESC`,
    params, tenantId
  );
}

export async function getInventoryABC(tenantId: string) {
  const items = await queryWithTenant<InventoryABCRow>(
    `SELECT sbi.sku_id AS skuId, ps.sku_name AS skuName,
            COALESCE(SUM(sbi.subtotal_amount), 0) AS totalSales
     FROM t_sale_bill_item sbi
     JOIN t_product_sku ps ON ps.id = sbi.sku_id
     WHERE sbi.tenant_id = ? AND sbi.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
     GROUP BY sbi.sku_id, ps.sku_name
     ORDER BY totalSales DESC`,
    [tenantId], tenantId
  );
  const grandTotal = items.reduce((s: number, i: any) => s + Number(i.totalSales), 0);
  let cumulative = 0;
  return items.map((item: any) => {
    cumulative += Number(item.totalSales);
    const pct = grandTotal > 0 ? cumulative / grandTotal : 0;
    let category = "C";
    if (pct <= 0.7) category = "A";
    else if (pct <= 0.9) category = "B";
    return { skuId: item.skuId, skuName: item.skuName, totalSales: item.totalSales, cumulativePct: Math.round(pct * 10000) / 100, category };
  });
}
