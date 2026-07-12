import { query, queryOne } from "../../shared/db";

export async function getOverview(tenantId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const todaySales = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS salesAmount,
            COUNT(*) AS orderCount,
            COALESCE(SUM(received_amount), 0) AS receivedAmount
     FROM t_sale_bill
     WHERE tenant_id = ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(created_at) = ?`,
    [tenantId, today]
  );

  const yesterdaySales = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS salesAmount,
            COUNT(*) AS orderCount
     FROM t_sale_bill
     WHERE tenant_id = ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(created_at) = ?`,
    [tenantId, yesterday]
  );

  const todayPurchase = await queryOne<any>(
    `SELECT COALESCE(SUM(payable_amount), 0) AS purchaseAmount,
            COUNT(*) AS orderCount
     FROM t_purchase_order
     WHERE tenant_id = ?
       AND order_status NOT IN ('DRAFT', 'CANCELLED')
       AND DATE(created_at) = ?`,
    [tenantId, today]
  );

  const monthSales = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS salesAmount,
            COUNT(*) AS orderCount,
            COALESCE(SUM(received_amount), 0) AS receivedAmount
     FROM t_sale_bill
     WHERE tenant_id = ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
    [tenantId]
  );

  const lastMonthSales = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS salesAmount,
            COUNT(*) AS orderCount
     FROM t_sale_bill
     WHERE tenant_id = ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m')`,
    [tenantId]
  );

  const monthPurchase = await queryOne<any>(
    `SELECT COALESCE(SUM(payable_amount), 0) AS purchaseAmount,
            COUNT(*) AS orderCount
     FROM t_purchase_order
     WHERE tenant_id = ?
       AND order_status NOT IN ('DRAFT', 'CANCELLED')
       AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
    [tenantId]
  );

  const yearSales = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS salesAmount,
            COUNT(*) AS orderCount,
            COALESCE(SUM(received_amount), 0) AS receivedAmount
     FROM t_sale_bill
     WHERE tenant_id = ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE_FORMAT(created_at, '%Y') = DATE_FORMAT(CURDATE(), '%Y')`,
    [tenantId]
  );

  const yearPurchase = await queryOne<any>(
    `SELECT COALESCE(SUM(payable_amount), 0) AS purchaseAmount,
            COUNT(*) AS orderCount
     FROM t_purchase_order
     WHERE tenant_id = ?
       AND order_status NOT IN ('DRAFT', 'CANCELLED')
       AND DATE_FORMAT(created_at, '%Y') = DATE_FORMAT(CURDATE(), '%Y')`,
    [tenantId]
  );

  // 待处理订单
  const pendingOrders = await queryOne<any>(
    `SELECT COUNT(*) AS count
     FROM t_miniapp_order
     WHERE tenant_id = ? AND order_status IN ('PENDING_PAYMENT', 'WAIT_DELIVERY', 'ACCEPTED')`,
    [tenantId]
  );

  const yesterdayPendingOrders = await queryOne<any>(
    `SELECT COUNT(*) AS count
     FROM t_miniapp_order
     WHERE tenant_id = ? AND order_status IN ('PENDING_PAYMENT', 'WAIT_DELIVERY', 'ACCEPTED')
       AND DATE(created_at) <= ?`,
    [tenantId, yesterday]
  );

  // 库存预警
  const stockAlerts = await queryOne<any>(
    `SELECT COUNT(*) AS count
     FROM stock_warning
     WHERE tenant_id = ? AND status = 'ACTIVE'`,
    [tenantId]
  );

  const urgentStockAlerts = await queryOne<any>(
    `SELECT COUNT(*) AS count
     FROM stock_warning
     WHERE tenant_id = ? AND status = 'ACTIVE' AND warning_level = 'URGENT'`,
    [tenantId]
  );

  const inventoryValue = await queryOne<any>(
    `SELECT COALESCE(SUM(ib.physical_qty * pp.cost_price), 0) AS amount,
            COUNT(DISTINCT ib.sku_id) AS skuCount
     FROM t_inventory_balance ib
     LEFT JOIN t_product_price pp ON pp.sku_id = ib.sku_id AND pp.tenant_id = ib.tenant_id
     WHERE ib.tenant_id = ?`,
    [tenantId]
  );

  const receivable = await queryOne<any>(
    `SELECT COALESCE(SUM(unreceived_amount), 0) AS amount
     FROM t_sale_bill
     WHERE tenant_id = ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')
       AND unreceived_amount > 0`,
    [tenantId]
  );

  const payable = await queryOne<any>(
    `SELECT COALESCE(SUM(unpaid_amount), 0) AS amount
     FROM t_purchase_order
     WHERE tenant_id = ?
       AND order_status NOT IN ('DRAFT', 'CANCELLED')
       AND unpaid_amount > 0`,
    [tenantId]
  );

  const todaySalesAmt = Number(todaySales?.salesAmount ?? 0);
  const yesterdaySalesAmt = Number(yesterdaySales?.salesAmount ?? 0);
  const todayOrderCnt = Number(todaySales?.orderCount ?? 0);
  const yesterdayOrderCnt = Number(yesterdaySales?.orderCount ?? 0);
  const monthSalesAmt = Number(monthSales?.salesAmount ?? 0);
  const lastMonthSalesAmt = Number(lastMonthSales?.salesAmount ?? 0);
  const monthOrderCnt = Number(monthSales?.orderCount ?? 0);
  const lastMonthOrderCnt = Number(lastMonthSales?.orderCount ?? 0);
  const pendingCnt = Number(pendingOrders?.count ?? 0);
  const yesterdayPendingCnt = Number(yesterdayPendingOrders?.count ?? 0);

  return {
    today: {
      salesAmount: todaySalesAmt,
      orderCount: todayOrderCnt,
      receivedAmount: Number(todaySales?.receivedAmount ?? 0),
      purchaseAmount: Number(todayPurchase?.purchaseAmount ?? 0),
      purchaseOrderCount: Number(todayPurchase?.orderCount ?? 0),
      compareYesterday: {
        salesAmountChange: yesterdaySalesAmt > 0 ? Math.round((todaySalesAmt - yesterdaySalesAmt) / yesterdaySalesAmt * 10000) / 100 : 0,
        orderCountChange: yesterdayOrderCnt > 0 ? todayOrderCnt - yesterdayOrderCnt : 0,
      },
    },
    month: {
      salesAmount: monthSalesAmt,
      orderCount: monthOrderCnt,
      receivedAmount: Number(monthSales?.receivedAmount ?? 0),
      purchaseAmount: Number(monthPurchase?.purchaseAmount ?? 0),
      purchaseOrderCount: Number(monthPurchase?.orderCount ?? 0),
      compareLastMonth: {
        salesAmountChange: lastMonthSalesAmt > 0 ? Math.round((monthSalesAmt - lastMonthSalesAmt) / lastMonthSalesAmt * 10000) / 100 : 0,
        orderCountChange: lastMonthOrderCnt > 0 ? monthOrderCnt - lastMonthOrderCnt : 0,
      },
    },
    year: {
      salesAmount: Number(yearSales?.salesAmount ?? 0),
      orderCount: Number(yearSales?.orderCount ?? 0),
      receivedAmount: Number(yearSales?.receivedAmount ?? 0),
      purchaseAmount: Number(yearPurchase?.purchaseAmount ?? 0),
      purchaseOrderCount: Number(yearPurchase?.orderCount ?? 0),
    },
    pending: {
      orderCount: pendingCnt,
      changeFromYesterday: pendingCnt - yesterdayPendingCnt,
    },
    stockAlerts: {
      total: Number(stockAlerts?.count ?? 0),
      urgent: Number(urgentStockAlerts?.count ?? 0),
    },
    inventory: {
      totalValue: Number(inventoryValue?.amount ?? 0),
      skuCount: Number(inventoryValue?.skuCount ?? 0),
    },
    finance: {
      receivable: Number(receivable?.amount ?? 0),
      payable: Number(payable?.amount ?? 0),
    },
  };
}

export async function getSalesTrend(tenantId: string) {
  const records = await query<any>(
    `SELECT DATE_FORMAT(sb.created_at, '%Y-%m') AS month,
            COALESCE(SUM(sb.receivable_amount), 0) AS salesAmount,
            COALESCE(SUM(sb.received_amount), 0) AS receivedAmount,
            COUNT(DISTINCT sb.bill_no) AS orderCount
     FROM t_sale_bill sb
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
     FROM t_sale_bill_item sbi
     JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id
     JOIN t_product_sku ps ON ps.id = sbi.sku_id AND ps.tenant_id = sbi.tenant_id
     JOIN t_product_spu psp ON psp.id = ps.spu_id AND psp.tenant_id = ps.tenant_id
     JOIN t_product_category pc ON pc.id = psp.category_id
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
     FROM t_sale_bill_item sbi
     JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id
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
     FROM t_sale_bill sb
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
     FROM t_alert_record
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

// ========== Phase 14: 工作台增强 ==========

export async function getTodos(tenantId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const items: Array<{
    type: string;
    priority: string;
    title: string;
    subtitle: string;
    count: number;
    link: string;
  }> = [];

  // 1. 待付款订单
  const pendingPayment = await queryOne<any>(
    `SELECT COUNT(*) AS count, MIN(created_at) AS earliest
     FROM t_miniapp_order
     WHERE tenant_id = ? AND order_status = 'PENDING_PAYMENT'`,
    [tenantId]
  );
  if (Number(pendingPayment?.count ?? 0) > 0) {
    items.push({
      type: "pending_payment",
      priority: "urgent",
      title: `${pendingPayment.count}笔订单待付款`,
      subtitle: pendingPayment.earliest ? `最早: ${new Date(pendingPayment.earliest).toISOString().slice(0, 16).replace('T', ' ')}` : "",
      count: Number(pendingPayment.count),
      link: "/orders?status=PENDING_PAYMENT",
    });
  }

  // 2. 待配送订单
  const pendingDelivery = await queryOne<any>(
    `SELECT COUNT(*) AS count, MIN(created_at) AS earliest
     FROM t_miniapp_order
     WHERE tenant_id = ? AND order_status IN ('WAIT_DELIVERY', 'ACCEPTED')`,
    [tenantId]
  );
  if (Number(pendingDelivery?.count ?? 0) > 0) {
    items.push({
      type: "pending_delivery",
      priority: "important",
      title: `${pendingDelivery.count}笔订单待配送`,
      subtitle: pendingDelivery.earliest ? `最早: ${new Date(pendingDelivery.earliest).toISOString().slice(0, 16).replace('T', ' ')}` : "",
      count: Number(pendingDelivery.count),
      link: "/orders?status=WAIT_DELIVERY",
    });
  }

  // 3. 配送中订单
  const delivering = await queryOne<any>(
    `SELECT COUNT(*) AS count
     FROM t_miniapp_order
     WHERE tenant_id = ? AND order_status = 'DELIVERING'`,
    [tenantId]
  );
  if (Number(delivering?.count ?? 0) > 0) {
    items.push({
      type: "delivering",
      priority: "normal",
      title: `${delivering.count}笔订单配送中`,
      subtitle: `预计今日送达`,
      count: Number(delivering.count),
      link: "/orders?status=DELIVERING",
    });
  }

  // 4. 库存预警
  const stockWarnings = await query<any>(
    `SELECT sku_name AS skuName, current_stock AS currentStock, warning_level AS warningLevel
     FROM stock_warning
     WHERE tenant_id = ? AND status = 'ACTIVE'
     ORDER BY CASE warning_level WHEN 'URGENT' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END
     LIMIT 3`,
    [tenantId]
  );
  if (stockWarnings.length > 0) {
    const urgentCount = stockWarnings.filter((s: any) => s.warningLevel === 'URGENT').length;
    const detail = stockWarnings.map((s: any) => `${s.skuName} 库存:${s.currentStock}`).join("; ");
    items.push({
      type: "stock_warning",
      priority: "warning",
      title: `${stockWarnings.length}项库存预警`,
      subtitle: urgentCount > 0 ? `${urgentCount}项紧急 - ${detail}` : detail,
      count: stockWarnings.length,
      link: "/inventory/warnings",
    });
  }

  // 5. 应收到期
  const overdueReceivables = await query<any>(
    `SELECT sb.customer_name AS customerName, sb.unreceived_amount AS unreceivedAmount,
            sb.bill_no AS billNo, sb.created_at AS createdAt
     FROM t_sale_bill sb
     WHERE sb.tenant_id = ? AND sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND sb.unreceived_amount > 0
       AND sb.due_date IS NOT NULL AND sb.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
     ORDER BY sb.due_date ASC
     LIMIT 3`,
    [tenantId]
  );
  if (overdueReceivables.length > 0) {
    const detail = overdueReceivables.map((r: any) => `${r.customerName} ¥${Number(r.unreceivedAmount).toLocaleString()}`).join("; ");
    items.push({
      type: "overdue_receivable",
      priority: "finance",
      title: `${overdueReceivables.length}笔应收账款即将到期`,
      subtitle: detail,
      count: overdueReceivables.length,
      link: "/finance/receivables",
    });
  }

  return { total: items.length, items };
}

export async function getRecentOrders(tenantId: string, limit: number = 5) {
  const records = await query<any>(
    `SELECT order_no AS orderNo, customer_name AS customerName,
            receivable_amount AS amount, order_status AS orderStatus,
            created_at AS createdAt
     FROM t_sale_bill
     WHERE tenant_id = ? AND business_status NOT IN ('DRAFT', 'VOIDED')
     ORDER BY created_at DESC
     LIMIT ?`,
    [tenantId, limit]
  );

  return records.map((r: any) => ({
    orderNo: r.orderNo,
    customerName: r.customerName,
    amount: Number(r.amount ?? 0),
    orderStatus: r.orderStatus,
    statusLabel: getStatusLabel(r.orderStatus),
    createdAt: r.createdAt,
  }));
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "草稿",
    PENDING_AUDIT: "待审核",
    AUDITED: "已审核",
    WAIT_DELIVERY: "待配送",
    DELIVERING: "配送中",
    COMPLETED: "已完成",
    CANCELLED: "已取消",
    VOIDED: "已作废",
  };
  return map[status] || status;
}

export async function getSalesTrendByDay(tenantId: string, days: number = 7) {
  const records = await query<any>(
    `SELECT DATE(sb.created_at) AS date,
            COALESCE(SUM(sb.receivable_amount), 0) AS salesAmount,
            COUNT(DISTINCT sb.bill_no) AS orderCount
     FROM t_sale_bill sb
     WHERE sb.tenant_id = ?
       AND sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND sb.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(sb.created_at)
     ORDER BY date ASC`,
    [tenantId, days]
  );

  return records.map((r: any) => ({
    date: r.date,
    salesAmount: Number(r.salesAmount),
    orderCount: Number(r.orderCount),
  }));
}