import cron from "node-cron";
import logger from "../shared/logger";
import { queryWithTenant, queryOneWithTenant } from "../shared/db";

// 获取所有租户
async function getTenants(): Promise<string[]> {
  const rows = await queryWithTenant<any>("SELECT DISTINCT tenant_id FROM t_sale_bill WHERE business_status = 'CREATED'", [], "");
  return rows.map((r: any) => r.tenant_id);
}

// 获取租户下所有门店
async function getStores(tenantId: string): Promise<number[]> {
  const rows = await queryWithTenant<any>("SELECT id FROM store WHERE tenant_id = ?", [tenantId], tenantId);
  return rows.map((r: any) => r.id);
}

// 1. 销售日报汇总
async function aggregateSalesDaily(tenantId: string, storeId: number, date: string) {
  const row = await queryOneWithTenant<any>(
    `SELECT
       COUNT(DISTINCT bill_no) AS orderCount,
       COUNT(DISTINCT customer_id) AS customerCount,
       COALESCE(SUM(goods_amount), 0) AS goodsAmount,
       COALESCE(SUM(discount_amount), 0) AS discountAmount,
       COALESCE(SUM(receivable_amount), 0) AS receivableAmount,
       COALESCE(SUM(received_amount), 0) AS receivedAmount,
       COALESCE(SUM(unreceived_amount), 0) AS unreceivedAmount
     FROM t_sale_bill
     WHERE tenant_id = ? AND store_id = ? AND business_status = 'CREATED' AND DATE(created_at) = ?`,
    [tenantId, storeId, date], tenantId
  );
  if (!row) return;
  const refund = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS refundCount, COALESCE(SUM(amount), 0) AS refundAmount
     FROM t_refund_order WHERE tenant_id = ? AND store_id = ? AND status = 'SUCCESS' AND DATE(created_at) = ?`,
    [tenantId, storeId, date], tenantId
  );
  const newCustomers = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS cnt FROM member WHERE tenant_id = ? AND DATE(created_at) = ?`,
    [tenantId, date], tenantId
  );
  await queryOneWithTenant<any>(
    `INSERT INTO report_sales_daily (tenant_id, store_id, report_date, order_count, customer_count, new_customer_count,
       goods_amount, discount_amount, receivable_amount, received_amount, unreceived_amount, refund_count, refund_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       order_count = VALUES(order_count), customer_count = VALUES(customer_count),
       new_customer_count = VALUES(new_customer_count), goods_amount = VALUES(goods_amount),
       discount_amount = VALUES(discount_amount), receivable_amount = VALUES(receivable_amount),
       received_amount = VALUES(received_amount), unreceived_amount = VALUES(unreceived_amount),
       refund_count = VALUES(refund_count), refund_amount = VALUES(refund_amount)`,
    [tenantId, storeId, date, row.orderCount, row.customerCount, Number(newCustomers?.cnt ?? 0),
     row.goodsAmount, row.discountAmount, row.receivableAmount, row.receivedAmount, row.unreceivedAmount,
     Number(refund?.refundCount ?? 0), Number(refund?.refundAmount ?? 0)], tenantId
  );
}

// 2. 收款统计汇总
async function aggregateCollectionStats(tenantId: string, storeId: number, date: string) {
  const row = await queryOneWithTenant<any>(
    `SELECT
       COUNT(*) AS totalLinks,
       COUNT(CASE WHEN status = 'PAID' THEN 1 END) AS paidLinks,
       COALESCE(SUM(amount), 0) AS totalAmount,
       COALESCE(SUM(CASE WHEN status = 'PAID' THEN paid_amount ELSE 0 END), 0) AS paidAmount,
       COUNT(CASE WHEN share_channel = 'WECHAT' THEN 1 END) AS wechatLinks,
       COUNT(CASE WHEN share_channel = 'ALIPAY' THEN 1 END) AS alipayLinks,
       COUNT(CASE WHEN share_channel NOT IN ('WECHAT', 'ALIPAY') THEN 1 END) AS otherChannelLinks,
       AVG(CASE WHEN status = 'PAID' AND paid_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, created_at, paid_at) END) AS avgPayHours
     FROM t_collection_link
     WHERE tenant_id = ? AND store_id = ? AND DATE(created_at) = ?`,
    [tenantId, storeId, date], tenantId
  );
  if (!row) return;
  await queryOneWithTenant<any>(
    `INSERT INTO report_collection_stats (tenant_id, store_id, report_date, total_links, paid_links, total_amount, paid_amount, wechat_links, alipay_links, other_channel_links, avg_pay_cycle_hours)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       total_links = VALUES(total_links), paid_links = VALUES(paid_links),
       total_amount = VALUES(total_amount), paid_amount = VALUES(paid_amount),
       wechat_links = VALUES(wechat_links), alipay_links = VALUES(alipay_links),
       other_channel_links = VALUES(other_channel_links), avg_pay_cycle_hours = VALUES(avg_pay_cycle_hours)`,
    [tenantId, storeId, date, row.totalLinks, row.paidLinks, row.totalAmount, row.paidAmount,
     row.wechatLinks, row.alipayLinks, row.otherChannelLinks, Math.round(Number(row.avgPayHours ?? 0) * 100) / 100], tenantId
  );
}

// 3. 商品销售汇总
async function aggregateProductSales(tenantId: string, storeId: number, date: string) {
  const rows = await queryWithTenant<any>(
    `SELECT sbi.sku_id AS skuId, sbi.sku_name AS skuName, pc.name AS categoryName,
            SUM(sbi.total_bottle_qty) AS saleQty, SUM(sbi.subtotal_amount) AS saleAmount,
            COUNT(DISTINCT sbi.bill_no) AS orderCount
     FROM t_sale_bill_item sbi
     LEFT JOIN t_product_sku ps ON ps.id = sbi.sku_id
     LEFT JOIN t_product_category pc ON pc.id = ps.category_id
     WHERE sbi.tenant_id = ? AND sbi.store_id = ? AND DATE(sbi.created_at) = ?
     GROUP BY sbi.sku_id, sbi.sku_name, pc.name`,
    [tenantId, storeId, date], tenantId
  );
  for (const r of rows) {
    await queryOneWithTenant<any>(
      `INSERT INTO report_product_sales (tenant_id, store_id, report_date, sku_id, sku_name, category_name, sale_bottle_qty, sale_amount, order_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         sku_name = VALUES(sku_name), category_name = VALUES(category_name),
         sale_bottle_qty = VALUES(sale_bottle_qty), sale_amount = VALUES(sale_amount), order_count = VALUES(order_count)`,
      [tenantId, storeId, date, r.skuId, r.skuName, r.categoryName, r.saleQty, r.saleAmount, r.orderCount], tenantId
    );
  }
}

// 4. 客户统计汇总
async function aggregateCustomerStats(tenantId: string, storeId: number, date: string) {
  const totalCustomers = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS cnt FROM member WHERE tenant_id = ? AND DATE(created_at) <= ?`, [tenantId, date], tenantId
  );
  const newCustomers = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS cnt FROM member WHERE tenant_id = ? AND DATE(created_at) = ?`, [tenantId, date], tenantId
  );
  const activeCustomers = await queryOneWithTenant<any>(
    `SELECT COUNT(DISTINCT customer_id) AS cnt FROM t_sale_bill WHERE tenant_id = ? AND store_id = ? AND business_status = 'CREATED' AND DATE(created_at) = ? AND customer_id IS NOT NULL`,
    [tenantId, storeId, date], tenantId
  );
  const repurchaseCustomers = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS cnt FROM (SELECT customer_id FROM t_sale_bill WHERE tenant_id = ? AND store_id = ? AND business_status = 'CREATED' AND DATE(created_at) = ? AND customer_id IS NOT NULL GROUP BY customer_id HAVING COUNT(bill_no) > 1) t`,
    [tenantId, storeId, date], tenantId
  );
  const lostCustomers = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS cnt FROM (SELECT customer_id FROM t_sale_bill WHERE tenant_id = ? AND store_id = ? AND business_status = 'CREATED' AND customer_id IS NOT NULL GROUP BY customer_id HAVING DATEDIFF(NOW(), MAX(created_at)) > 90) t`,
    [tenantId, storeId, date], tenantId
  );
  const avgOrder = await queryOneWithTenant<any>(
    `SELECT AVG(receivable_amount) AS avgVal FROM t_sale_bill WHERE tenant_id = ? AND store_id = ? AND business_status = 'CREATED' AND DATE(created_at) = ?`,
    [tenantId, storeId, date], tenantId
  );
  const totalRevenue = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS amt FROM t_sale_bill WHERE tenant_id = ? AND store_id = ? AND business_status = 'CREATED' AND DATE(created_at) = ?`,
    [tenantId, storeId, date], tenantId
  );
  const totalC = Number(totalCustomers?.cnt ?? 0);
  const repurchaseC = Number(repurchaseCustomers?.cnt ?? 0);
  await queryOneWithTenant<any>(
    `INSERT INTO report_customer_stats (tenant_id, store_id, report_date, total_customers, new_customers, active_customers, repurchase_customers, lost_customers, avg_order_value, total_revenue, repurchase_rate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       total_customers = VALUES(total_customers), new_customers = VALUES(new_customers),
       active_customers = VALUES(active_customers), repurchase_customers = VALUES(repurchase_customers),
       lost_customers = VALUES(lost_customers), avg_order_value = VALUES(avg_order_value),
       total_revenue = VALUES(total_revenue), repurchase_rate = VALUES(repurchase_rate)`,
    [tenantId, storeId, date, totalC, Number(newCustomers?.cnt ?? 0), Number(activeCustomers?.cnt ?? 0),
     repurchaseC, Number(lostCustomers?.cnt ?? 0), Math.round(Number(avgOrder?.avgVal ?? 0) * 100) / 100,
     Number(totalRevenue?.amt ?? 0), totalC > 0 ? Math.round((repurchaseC / totalC) * 10000) / 100 : 0], tenantId
  );
}

// 5. 库存日报汇总
async function aggregateInventoryDaily(tenantId: string, storeId: number, date: string) {
  const row = await queryOneWithTenant<any>(
    `SELECT
       COUNT(DISTINCT sku_id) AS skuCount,
       COALESCE(SUM(physical_qty), 0) AS totalPhysicalQty,
       COALESCE(SUM(available_qty), 0) AS totalAvailableQty,
       COALESCE(SUM(locked_qty), 0) AS totalLockedQty
     FROM t_inventory_balance
     WHERE tenant_id = ? AND store_id = ?`,
    [tenantId, storeId], tenantId
  );
  const lowStock = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS cnt FROM t_inventory_balance WHERE tenant_id = ? AND store_id = ? AND available_qty <= safety_stock AND available_qty > 0`,
    [tenantId, storeId], tenantId
  );
  const zeroStock = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS cnt FROM t_inventory_balance WHERE tenant_id = ? AND store_id = ? AND available_qty <= 0`,
    [tenantId, storeId], tenantId
  );
  if (!row) return;
  await queryOneWithTenant<any>(
    `INSERT INTO report_inventory_daily (tenant_id, store_id, report_date, total_sku_count, total_physical_qty, total_available_qty, total_locked_qty, total_value, low_stock_sku_count, zero_stock_sku_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       total_sku_count = VALUES(total_sku_count), total_physical_qty = VALUES(total_physical_qty),
       total_available_qty = VALUES(total_available_qty), total_locked_qty = VALUES(total_locked_qty),
       total_value = VALUES(total_value), low_stock_sku_count = VALUES(low_stock_sku_count),
       zero_stock_sku_count = VALUES(zero_stock_sku_count)`,
    [tenantId, storeId, date, row.skuCount, row.totalPhysicalQty, row.totalAvailableQty, row.totalLockedQty,
     0, Number(lowStock?.cnt ?? 0), Number(zeroStock?.cnt ?? 0)], tenantId
  );
}

// 每日汇总主函数
async function runDailyAggregation() {
  const today = new Date().toISOString().slice(0, 10);
  logger.info(`[报表定时任务] 开始汇总 ${today} 的数据...`);
  try {
    const tenants = await getTenants();
    for (const tenantId of tenants) {
      const stores = await getStores(tenantId);
      for (const storeId of stores) {
        await aggregateSalesDaily(tenantId, storeId, today);
        await aggregateCollectionStats(tenantId, storeId, today);
        await aggregateProductSales(tenantId, storeId, today);
        await aggregateCustomerStats(tenantId, storeId, today);
        await aggregateInventoryDaily(tenantId, storeId, today);
      }
    }
    logger.info(`[报表定时任务] 汇总完成: ${tenants.length} 个租户`);
  } catch (err) {
    logger.error("[报表定时任务] 汇总失败:", err);
  }
}[];

// 每天凌晨 2:00 执行
cron.schedule("0 2 * * *", runDailyAggregation);

export { runDailyAggregation };