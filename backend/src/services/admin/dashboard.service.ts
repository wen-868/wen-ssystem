import { query, queryOne } from "../../shared/db.js";

export async function getOverview(tenantId: string) {
  const todaySales = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS salesAmount,
            COUNT(*) AS orderCount,
            COALESCE(SUM(received_amount), 0) AS receivedAmount
     FROM sale_bill
     WHERE tenant_id = ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(created_at) = CURDATE()`,
    [tenantId]
  );

  const todayPurchase = await queryOne<any>(
    `SELECT COALESCE(SUM(payable_amount), 0) AS purchaseAmount,
            COUNT(*) AS orderCount
     FROM purchase_order
     WHERE tenant_id = ?
       AND order_status NOT IN ('DRAFT', 'CANCELLED')
       AND DATE(created_at) = CURDATE()`,
    [tenantId]
  );

  const monthSales = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS salesAmount,
            COUNT(*) AS orderCount,
            COALESCE(SUM(received_amount), 0) AS receivedAmount
     FROM sale_bill
     WHERE tenant_id = ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
    [tenantId]
  );

  const monthPurchase = await queryOne<any>(
    `SELECT COALESCE(SUM(payable_amount), 0) AS purchaseAmount,
            COUNT(*) AS orderCount
     FROM purchase_order
     WHERE tenant_id = ?
       AND order_status NOT IN ('DRAFT', 'CANCELLED')
       AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
    [tenantId]
  );

  const yearSales = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS salesAmount,
            COUNT(*) AS orderCount,
            COALESCE(SUM(received_amount), 0) AS receivedAmount
     FROM sale_bill
     WHERE tenant_id = ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE_FORMAT(created_at, '%Y') = DATE_FORMAT(CURDATE(), '%Y')`,
    [tenantId]
  );

  const yearPurchase = await queryOne<any>(
    `SELECT COALESCE(SUM(payable_amount), 0) AS purchaseAmount,
            COUNT(*) AS orderCount
     FROM purchase_order
     WHERE tenant_id = ?
       AND order_status NOT IN ('DRAFT', 'CANCELLED')
       AND DATE_FORMAT(created_at, '%Y') = DATE_FORMAT(CURDATE(), '%Y')`,
    [tenantId]
  );

  const inventoryValue = await queryOne<any>(
    `SELECT COALESCE(SUM(ib.physical_qty * pp.cost_price), 0) AS amount,
            COUNT(DISTINCT ib.sku_id) AS skuCount
     FROM inventory_balance ib
     LEFT JOIN product_price pp ON pp.sku_id = ib.sku_id AND pp.tenant_id = ib.tenant_id
     WHERE ib.tenant_id = ?`,
    [tenantId]
  );

  const receivable = await queryOne<any>(
    `SELECT COALESCE(SUM(unreceived_amount), 0) AS amount
     FROM sale_bill
     WHERE tenant_id = ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')
       AND unreceived_amount > 0`,
    [tenantId]
  );

  const payable = await queryOne<any>(
    `SELECT COALESCE(SUM(unpaid_amount), 0) AS amount
     FROM purchase_order
     WHERE tenant_id = ?
       AND order_status NOT IN ('DRAFT', 'CANCELLED')
       AND unpaid_amount > 0`,
    [tenantId]
  );

  return {
    today: {
      salesAmount: Number(todaySales?.salesAmount ?? 0),
      orderCount: Number(todaySales?.orderCount ?? 0),
      receivedAmount: Number(todaySales?.receivedAmount ?? 0),
      purchaseAmount: Number(todayPurchase?.purchaseAmount ?? 0),
      purchaseOrderCount: Number(todayPurchase?.orderCount ?? 0)
    },
    month: {
      salesAmount: Number(monthSales?.salesAmount ?? 0),
      orderCount: Number(monthSales?.orderCount ?? 0),
      receivedAmount: Number(monthSales?.receivedAmount ?? 0),
      purchaseAmount: Number(monthPurchase?.purchaseAmount ?? 0),
      purchaseOrderCount: Number(monthPurchase?.orderCount ?? 0)
    },
    year: {
      salesAmount: Number(yearSales?.salesAmount ?? 0),
      orderCount: Number(yearSales?.orderCount ?? 0),
      receivedAmount: Number(yearSales?.receivedAmount ?? 0),
      purchaseAmount: Number(yearPurchase?.purchaseAmount ?? 0),
      purchaseOrderCount: Number(yearPurchase?.orderCount ?? 0)
    },
    inventory: {
      totalValue: Number(inventoryValue?.amount ?? 0),
      skuCount: Number(inventoryValue?.skuCount ?? 0)
    },
    finance: {
      receivable: Number(receivable?.amount ?? 0),
      payable: Number(payable?.amount ?? 0)
    }
  };
}

export async function getSalesTrend(tenantId: string) {
  const records = await query<any>(
    `SELECT DATE_FORMAT(sb.created_at, '%Y-%m') AS month,
            COALESCE(SUM(sb.receivable_amount), 0) AS salesAmount,
            COALESCE(SUM(sb.received_amount), 0) AS receivedAmount,
            COUNT(DISTINCT sb.bill_no) AS orderCount
     FROM sale_bill sb
     WHERE sb.tenant_id = ?
       AND sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND sb.created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
     GROUP BY DATE_FORMAT(sb.created_at, '%Y-%m')
     ORDER BY month ASC`,
    [tenantId]
  );

  return records.map((r: any) => ({
    month: r.month,
    salesAmount: Number(r.salesAmount),
    receivedAmount: Number(r.receivedAmount),
    orderCount: Number(r.orderCount)
  }));
}

export async function getCategoryPie(tenantId: string, dateStart: string, dateEnd: string) {
  const records = await query<any>(
    `SELECT pc.name AS categoryName,
            COALESCE(SUM(sbi.subtotal_amount), 0) AS totalAmount,
            SUM(sbi.total_bottle_qty) AS totalQty
     FROM sale_bill_item sbi
     JOIN sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id
     JOIN product_sku ps ON ps.id = sbi.sku_id AND ps.tenant_id = sbi.tenant_id
     JOIN product_spu psp ON psp.id = ps.spu_id AND psp.tenant_id = ps.tenant_id
     JOIN product_category pc ON pc.id = psp.category_id
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND sb.tenant_id = ?
       AND DATE(sb.created_at) BETWEEN ? AND ?
     GROUP BY pc.name
     ORDER BY totalAmount DESC`,
    [tenantId, dateStart, dateEnd]
  );

  const totalAmount = records.reduce((sum: number, r: any) => sum + Number(r.totalAmount), 0);

  return records.map((r: any) => ({
    categoryName: r.categoryName,
    totalAmount: Number(r.totalAmount),
    totalQty: Number(r.totalQty),
    percentage: totalAmount > 0 ? Math.round((Number(r.totalAmount) / totalAmount) * 10000) / 100 : 0
  }));
}

export async function getTopProducts(tenantId: string, dateStart: string, dateEnd: string) {
  const records = await query<any>(
    `SELECT sbi.sku_id AS skuId, sbi.sku_name AS skuName,
            SUM(sbi.total_bottle_qty) AS totalQty,
            COALESCE(SUM(sbi.subtotal_amount), 0) AS totalAmount,
            COUNT(DISTINCT sbi.bill_no) AS orderCount
     FROM sale_bill_item sbi
     JOIN sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND sb.tenant_id = ?
       AND DATE(sb.created_at) BETWEEN ? AND ?
     GROUP BY sbi.sku_id, sbi.sku_name
     ORDER BY totalAmount DESC
     LIMIT 10`,
    [tenantId, dateStart, dateEnd]
  );

  return records.map((r: any) => ({
    skuId: r.skuId,
    skuName: r.skuName,
    totalQty: Number(r.totalQty),
    totalAmount: Number(r.totalAmount),
    orderCount: Number(r.orderCount)
  }));
}

export async function getTopCustomers(tenantId: string, dateStart: string, dateEnd: string) {
  const records = await query<any>(
    `SELECT sb.customer_id AS customerId, sb.customer_name AS customerName,
            COUNT(DISTINCT sb.bill_no) AS orderCount,
            COALESCE(SUM(sb.receivable_amount), 0) AS totalAmount,
            COALESCE(SUM(sb.received_amount), 0) AS receivedAmount
     FROM sale_bill sb
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND sb.tenant_id = ?
       AND sb.customer_id IS NOT NULL
       AND DATE(sb.created_at) BETWEEN ? AND ?
     GROUP BY sb.customer_id, sb.customer_name
     ORDER BY totalAmount DESC
     LIMIT 10`,
    [tenantId, dateStart, dateEnd]
  );

  return records.map((r: any) => ({
    customerId: r.customerId,
    customerName: r.customerName,
    orderCount: Number(r.orderCount),
    totalAmount: Number(r.totalAmount),
    receivedAmount: Number(r.receivedAmount)
  }));
}

export async function getRecentAlerts(tenantId: string, limit: number) {
  const records = await query<any>(
    `SELECT id, alert_no AS alertNo,
            rule_type AS ruleType, alert_level AS alertLevel,
            title, description,
            biz_type AS bizType, biz_id AS bizId,
            status, created_at AS createdAt
     FROM alert_record
     WHERE tenant_id = ? AND status = 'PENDING'
     ORDER BY
       CASE alert_level
         WHEN 'CRITICAL' THEN 1
         WHEN 'WARNING' THEN 2
         WHEN 'INFO' THEN 3
         ELSE 4
       END,
       created_at DESC
     LIMIT ?`,
    [tenantId, limit]
  );

  return records;
}