import { query, queryOne } from "../../shared/db";
import { cacheGet, CacheKeys } from "../../shared/redis-cache";

// ==================== 类型定义 ====================

/** 销售综合统计（概览页） */
interface OverviewSalesStatsRow {
  todaySalesAmount: number | string;
  todayOrderCount: number | string;
  todayReceivedAmount: number | string;
  yesterdaySalesAmount: number | string;
  yesterdayOrderCount: number | string;
  monthSalesAmount: number | string;
  monthOrderCount: number | string;
  monthReceivedAmount: number | string;
  lastMonthSalesAmount: number | string;
  lastMonthOrderCount: number | string;
  yearSalesAmount: number | string;
  yearOrderCount: number | string;
  yearReceivedAmount: number | string;
  receivableAmount: number | string;
}

/** 采购综合统计（概览页） */
interface OverviewPurchaseStatsRow {
  todayPurchaseAmount: number | string;
  todayPurchaseOrderCount: number | string;
  monthPurchaseAmount: number | string;
  monthPurchaseOrderCount: number | string;
  yearPurchaseAmount: number | string;
  yearPurchaseOrderCount: number | string;
  payableAmount: number | string;
}

/** 待处理订单统计 */
interface PendingOrdersStatsRow {
  currentPendingCount: number | string;
  yesterdayPendingCount: number | string;
}

/** 库存预警统计 */
interface StockAlertStatsRow {
  totalAlerts: number | string;
  urgentAlerts: number | string;
}

/** 库存价值统计 */
interface InventoryValueStatsRow {
  amount: number | string;
  skuCount: number | string;
}

/** 月销售趋势行 */
interface SalesTrendRow {
  month: string;
  salesAmount: number | string;
  receivedAmount: number | string;
  orderCount: number | string;
}

/** 分类饼图行 */
interface CategoryPieRow {
  categoryName: string;
  totalAmount: number | string;
  totalQty: number | string;
}

/** 商品销量排行行 */
interface TopProductRow {
  skuId: number;
  skuName: string;
  totalQty: number | string;
  totalAmount: number | string;
  orderCount: number | string;
}

/** 客户销售排行行 */
interface TopCustomerRow {
  customerId: number;
  customerName: string;
  orderCount: number | string;
  totalAmount: number | string;
  receivedAmount: number | string;
}

/** 最近预警行 */
interface RecentAlertRow {
  id: number;
  alertNo: string;
  ruleType: string;
  alertLevel: string;
  title: string;
  description: string | null;
  bizType: string;
  bizId: number | string;
  status: string;
  createdAt: string | Date;
}

/** 计数+最早时间行 */
interface CountEarliestRow {
  count: number | string;
  earliest: string | Date | null;
}

/** 计数行 */
interface CountRow {
  count: number | string;
}

/** 库存预警项行（待办用） */
interface StockWarningBriefRow {
  skuName: string;
  currentStock: number | string;
  warningLevel: string;
}

/** 应收到期行（待办用） */
interface OverdueReceivableRow {
  customerName: string;
  unreceivedAmount: number | string;
  billNo: string;
  createdAt: string | Date;
}

/** 最近订单行 */
interface RecentOrderRow {
  orderNo: string;
  customerName: string;
  amount: number | string;
  orderStatus: string;
  createdAt: string | Date;
}

/** 日销售趋势行 */
interface SalesDayTrendRow {
  date: string;
  salesAmount: number | string;
  orderCount: number | string;
}

/** 库存统计行 */
interface InventoryStatsRow {
  totalQty: number | string;
  availableQty: number | string;
  lockedQty: number | string;
  skuCount: number | string;
  storeCount: number | string;
}

/** 库存总价值行 */
interface TotalValueRow {
  totalValue: number | string;
}

/** 库存周转行 */
interface InventoryTurnoverRow {
  month: string;
  soldQty: number | string;
  soldAmount: number | string;
}

/** 平均库存行 */
interface AvgInventoryRow {
  avgQty: number | string;
}

/** 库存预警列表行 */
interface InventoryWarningListRow {
  skuName: string;
  currentStock: number | string;
  warningThreshold: number | string;
  warningLevel: string;
  storeName: string;
}

/** 库存价值分析行 */
interface InventoryValueAnalysisRow {
  categoryName: string | null;
  skuCount: number | string;
  totalQty: number | string;
  totalValue: number | string;
}

/** 客户统计行 */
interface CustomerStatsRow {
  totalCount: number | string;
  todayNewCount: number | string;
  monthlyNewCount: number | string;
  wholesaleCount: number | string;
  retailCount: number | string;
  activeCount: number | string;
}

/** 客户增长趋势行 */
interface CustomerGrowthRow {
  month: string;
  newCustomers: number | string;
  activeCustomers: number | string;
}

/** 平均金额行 */
interface AvgAmountRow {
  avgAmount: number | string;
}

/** 客户分类统计行 */
interface CustomerCategoryRow {
  customerType: string | null;
  customerCount: number | string;
  totalAmount: number | string;
  orderCount: number | string;
}

/** 供应商统计行 */
interface SupplierStatsRow {
  totalCount: number | string;
  monthlyNewCount: number | string;
  activeCount: number | string;
}

/** 供应商采购统计行 */
interface SupplierPurchaseStatsRow {
  activeSupplierCount: number | string;
  totalPurchaseAmount: number | string;
  purchaseOrderCount: number | string;
}

/** 供应商采购排行行 */
interface SupplierRankingRow {
  supplierId: number;
  supplierName: string;
  orderCount: number | string;
  totalAmount: number | string;
  paidAmount: number | string;
}

/** 供应商准时率行 */
interface SupplierOnTimeRow {
  supplierName: string;
  totalOrders: number | string;
  onTimeOrders: number | string;
  delayedOrders: number | string;
}

/** 供应商趋势行 */
interface SupplierTrendRow {
  month: string;
  activeSupplierCount: number | string;
  totalAmount: number | string;
  orderCount: number | string;
}

/** 员工销售排行行 */
interface TopEmployeeRow {
  employeeId: number;
  employeeName: string | null;
  orderCount: number | string;
  totalAmount: number | string;
  receivedAmount: number | string;
}

export async function getOverview(tenantId: string) {
  return cacheGet(CacheKeys.dashboard(Number(tenantId)), async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // 合并查询：销售统计（今日/昨日/本月/上月/本年）
    // 将原来的 5 个 queryOne 合并为 1 个
    const salesStats = await queryOne<OverviewSalesStatsRow>(
      `SELECT
         -- 今日销售
         COALESCE(SUM(CASE WHEN DATE(sb.created_at) = ? THEN sb.receivable_amount END), 0) AS todaySalesAmount,
         COALESCE(COUNT(CASE WHEN DATE(sb.created_at) = ? THEN 1 END), 0) AS todayOrderCount,
         COALESCE(SUM(CASE WHEN DATE(sb.created_at) = ? THEN sb.received_amount END), 0) AS todayReceivedAmount,
         -- 昨日销售
         COALESCE(SUM(CASE WHEN DATE(sb.created_at) = ? THEN sb.receivable_amount END), 0) AS yesterdaySalesAmount,
         COALESCE(COUNT(CASE WHEN DATE(sb.created_at) = ? THEN 1 END), 0) AS yesterdayOrderCount,
         -- 本月销售
         COALESCE(SUM(CASE WHEN DATE_FORMAT(sb.created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') THEN sb.receivable_amount END), 0) AS monthSalesAmount,
         COALESCE(COUNT(CASE WHEN DATE_FORMAT(sb.created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') THEN 1 END), 0) AS monthOrderCount,
         COALESCE(SUM(CASE WHEN DATE_FORMAT(sb.created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') THEN sb.received_amount END), 0) AS monthReceivedAmount,
         -- 上月销售
         COALESCE(SUM(CASE WHEN DATE_FORMAT(sb.created_at, '%Y-%m') = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m') THEN sb.receivable_amount END), 0) AS lastMonthSalesAmount,
         COALESCE(COUNT(CASE WHEN DATE_FORMAT(sb.created_at, '%Y-%m') = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m') THEN 1 END), 0) AS lastMonthOrderCount,
         -- 本年销售
         COALESCE(SUM(CASE WHEN DATE_FORMAT(sb.created_at, '%Y') = DATE_FORMAT(CURDATE(), '%Y') THEN sb.receivable_amount END), 0) AS yearSalesAmount,
         COALESCE(COUNT(CASE WHEN DATE_FORMAT(sb.created_at, '%Y') = DATE_FORMAT(CURDATE(), '%Y') THEN 1 END), 0) AS yearOrderCount,
         COALESCE(SUM(CASE WHEN DATE_FORMAT(sb.created_at, '%Y') = DATE_FORMAT(CURDATE(), '%Y') THEN sb.received_amount END), 0) AS yearReceivedAmount,
         -- 应收账款
         COALESCE(SUM(CASE WHEN sb.unreceived_amount > 0 THEN sb.unreceived_amount END), 0) AS receivableAmount
       FROM t_sale_bill sb
       WHERE sb.tenant_id = ? AND sb.business_status NOT IN ('DRAFT', 'VOIDED')`,
      [today, today, today, yesterday, yesterday, tenantId]
    );

    // 合并查询：采购统计（今日/本月/本年）
    // 将原来的 3 个 queryOne 合并为 1 个
    const purchaseStats = await queryOne<OverviewPurchaseStatsRow>(
      `SELECT
         -- 今日采购
         COALESCE(SUM(CASE WHEN DATE(po.created_at) = ? THEN po.payable_amount END), 0) AS todayPurchaseAmount,
         COALESCE(COUNT(CASE WHEN DATE(po.created_at) = ? THEN 1 END), 0) AS todayPurchaseOrderCount,
         -- 本月采购
         COALESCE(SUM(CASE WHEN DATE_FORMAT(po.created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') THEN po.payable_amount END), 0) AS monthPurchaseAmount,
         COALESCE(COUNT(CASE WHEN DATE_FORMAT(po.created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') THEN 1 END), 0) AS monthPurchaseOrderCount,
         -- 本年采购
         COALESCE(SUM(CASE WHEN DATE_FORMAT(po.created_at, '%Y') = DATE_FORMAT(CURDATE(), '%Y') THEN po.payable_amount END), 0) AS yearPurchaseAmount,
         COALESCE(COUNT(CASE WHEN DATE_FORMAT(po.created_at, '%Y') = DATE_FORMAT(CURDATE(), '%Y') THEN 1 END), 0) AS yearPurchaseOrderCount,
         -- 应付账款
         COALESCE(SUM(CASE WHEN po.unpaid_amount > 0 THEN po.unpaid_amount END), 0) AS payableAmount
       FROM t_purchase_order po
       WHERE po.tenant_id = ? AND po.order_status NOT IN ('DRAFT', 'CANCELLED')`,
      [today, today, tenantId]
    );

    // 合并查询：待处理订单 + 库存预警
    // 将原来的 4 个 queryOne 合并为 2 个
    const pendingOrders = await queryOne<PendingOrdersStatsRow>(
      `SELECT
         -- 当前待处理订单
         COALESCE(COUNT(CASE WHEN mo.order_status IN ('PENDING_PAYMENT', 'WAIT_DELIVERY', 'ACCEPTED') THEN 1 END), 0) AS currentPendingCount,
         -- 昨日之前的待处理订单（用于计算变化）
         COALESCE(COUNT(CASE WHEN mo.order_status IN ('PENDING_PAYMENT', 'WAIT_DELIVERY', 'ACCEPTED') AND DATE(mo.created_at) <= ? THEN 1 END), 0) AS yesterdayPendingCount
       FROM t_miniapp_order mo
       WHERE mo.tenant_id = ?`,
      [yesterday, tenantId]
    );

    const stockAlerts = await queryOne<StockAlertStatsRow>(
      `SELECT
         COALESCE(COUNT(CASE WHEN sw.status = 'ACTIVE' THEN 1 END), 0) AS totalAlerts,
         COALESCE(COUNT(CASE WHEN sw.status = 'ACTIVE' AND sw.warning_level = 'URGENT' THEN 1 END), 0) AS urgentAlerts
       FROM t_stock_warning sw
       WHERE sw.tenant_id = ?`,
      [tenantId]
    );

    // 库存价值
    const inventoryValue = await queryOne<InventoryValueStatsRow>(
      `SELECT COALESCE(SUM(ib.physical_qty * pp.cost_price), 0) AS amount,
              COUNT(DISTINCT ib.sku_id) AS skuCount
       FROM t_inventory_balance ib
       LEFT JOIN t_product_price pp ON pp.sku_id = ib.sku_id AND pp.tenant_id = ib.tenant_id
       WHERE ib.tenant_id = ?`,
      [tenantId]
    );

    const todaySalesAmt = Number(salesStats?.todaySalesAmount ?? 0);
    const yesterdaySalesAmt = Number(salesStats?.yesterdaySalesAmount ?? 0);
    const todayOrderCnt = Number(salesStats?.todayOrderCount ?? 0);
    const yesterdayOrderCnt = Number(salesStats?.yesterdayOrderCount ?? 0);
    const monthSalesAmt = Number(salesStats?.monthSalesAmount ?? 0);
    const lastMonthSalesAmt = Number(salesStats?.lastMonthSalesAmount ?? 0);
    const monthOrderCnt = Number(salesStats?.monthOrderCount ?? 0);
    const lastMonthOrderCnt = Number(salesStats?.lastMonthOrderCount ?? 0);
    const pendingCnt = Number(pendingOrders?.currentPendingCount ?? 0);
    const yesterdayPendingCnt = Number(pendingOrders?.yesterdayPendingCount ?? 0);

    return {
      today: {
        salesAmount: todaySalesAmt,
        orderCount: todayOrderCnt,
        receivedAmount: Number(salesStats?.todayReceivedAmount ?? 0),
        purchaseAmount: Number(purchaseStats?.todayPurchaseAmount ?? 0),
        purchaseOrderCount: Number(purchaseStats?.todayPurchaseOrderCount ?? 0),
        compareYesterday: {
          salesAmountChange: yesterdaySalesAmt > 0 ? Math.round((todaySalesAmt - yesterdaySalesAmt) / yesterdaySalesAmt * 10000) / 100 : 0,
          orderCountChange: yesterdayOrderCnt > 0 ? todayOrderCnt - yesterdayOrderCnt : 0,
        },
      },
      month: {
        salesAmount: monthSalesAmt,
        orderCount: monthOrderCnt,
        receivedAmount: Number(salesStats?.monthReceivedAmount ?? 0),
        purchaseAmount: Number(purchaseStats?.monthPurchaseAmount ?? 0),
        purchaseOrderCount: Number(purchaseStats?.monthPurchaseOrderCount ?? 0),
        compareLastMonth: {
          salesAmountChange: lastMonthSalesAmt > 0 ? Math.round((monthSalesAmt - lastMonthSalesAmt) / lastMonthSalesAmt * 10000) / 100 : 0,
          orderCountChange: lastMonthOrderCnt > 0 ? monthOrderCnt - lastMonthOrderCnt : 0,
        },
      },
      year: {
        salesAmount: Number(salesStats?.yearSalesAmount ?? 0),
        orderCount: Number(salesStats?.yearOrderCount ?? 0),
        receivedAmount: Number(salesStats?.yearReceivedAmount ?? 0),
        purchaseAmount: Number(purchaseStats?.yearPurchaseAmount ?? 0),
        purchaseOrderCount: Number(purchaseStats?.yearPurchaseOrderCount ?? 0),
      },
      pending: {
        orderCount: pendingCnt,
        changeFromYesterday: pendingCnt - yesterdayPendingCnt,
      },
      stockAlerts: {
        total: Number(stockAlerts?.totalAlerts ?? 0),
        urgent: Number(stockAlerts?.urgentAlerts ?? 0),
      },
      inventory: {
        totalValue: Number(inventoryValue?.amount ?? 0),
        skuCount: Number(inventoryValue?.skuCount ?? 0),
      },
      finance: {
        receivable: Number(salesStats?.receivableAmount ?? 0),
        payable: Number(purchaseStats?.payableAmount ?? 0),
      },
    };
  }, 300);
}

export async function getSalesTrend(tenantId: string) {
  const records = await query<SalesTrendRow>(
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

  return records.map((r) => ({
    month: r.month,
    salesAmount: Number(r.salesAmount),
    receivedAmount: Number(r.receivedAmount),
    orderCount: Number(r.orderCount)
  }));
}

export async function getCategoryPie(tenantId: string, dateStart: string, dateEnd: string) {
  const records = await query<CategoryPieRow>(
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

  const totalAmount = records.reduce((sum: number, r) => sum + Number(r.totalAmount), 0);

  return records.map((r) => ({
    categoryName: r.categoryName,
    totalAmount: Number(r.totalAmount),
    totalQty: Number(r.totalQty),
    percentage: totalAmount > 0 ? Math.round((Number(r.totalAmount) / totalAmount) * 10000) / 100 : 0
  }));
}

export async function getTopProducts(tenantId: string, dateStart: string, dateEnd: string) {
  const records = await query<TopProductRow>(
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

  return records.map((r) => ({
    skuId: r.skuId,
    skuName: r.skuName,
    totalQty: Number(r.totalQty),
    totalAmount: Number(r.totalAmount),
    orderCount: Number(r.orderCount)
  }));
}

export async function getTopCustomers(tenantId: string, dateStart: string, dateEnd: string) {
  const records = await query<TopCustomerRow>(
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

  return records.map((r) => ({
    customerId: r.customerId,
    customerName: r.customerName,
    orderCount: Number(r.orderCount),
    totalAmount: Number(r.totalAmount),
    receivedAmount: Number(r.receivedAmount)
  }));
}

export async function getRecentAlerts(tenantId: string, limit: number) {
  const records = await query<RecentAlertRow>(
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
  const items: Array<{
    type: string;
    priority: string;
    title: string;
    subtitle: string;
    count: number;
    link: string;
  }> = [];

  // 1. 待付款订单
  const pendingPayment = await queryOne<CountEarliestRow>(
    `SELECT COUNT(*) AS count, MIN(created_at) AS earliest
     FROM t_miniapp_order
     WHERE tenant_id = ? AND order_status = 'PENDING_PAYMENT'`,
    [tenantId]
  );
  if (pendingPayment && Number(pendingPayment.count) > 0) {
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
  const pendingDelivery = await queryOne<CountEarliestRow>(
    `SELECT COUNT(*) AS count, MIN(created_at) AS earliest
     FROM t_miniapp_order
     WHERE tenant_id = ? AND order_status IN ('WAIT_DELIVERY', 'ACCEPTED')`,
    [tenantId]
  );
  if (pendingDelivery && Number(pendingDelivery.count) > 0) {
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
  const delivering = await queryOne<CountRow>(
    `SELECT COUNT(*) AS count
     FROM t_miniapp_order
     WHERE tenant_id = ? AND order_status = 'DELIVERING'`,
    [tenantId]
  );
  if (delivering && Number(delivering.count) > 0) {
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
  const stockWarnings = await query<StockWarningBriefRow>(
    `SELECT sku_name AS skuName, current_stock AS currentStock, warning_level AS warningLevel
     FROM t_stock_warning
     WHERE tenant_id = ? AND status = 'ACTIVE'
     ORDER BY CASE warning_level WHEN 'URGENT' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END
     LIMIT 3`,
    [tenantId]
  );
  if (stockWarnings.length > 0) {
    const urgentCount = stockWarnings.filter((s) => s.warningLevel === 'URGENT').length;
    const detail = stockWarnings.map((s) => `${s.skuName} 库存:${s.currentStock}`).join("; ");
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
  const overdueReceivables = await query<OverdueReceivableRow>(
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
    const detail = overdueReceivables.map((r) => `${r.customerName} ¥${Number(r.unreceivedAmount).toLocaleString()}`).join("; ");
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
  const records = await query<RecentOrderRow>(
    `SELECT bill_no AS orderNo, customer_name AS customerName,
            receivable_amount AS amount, business_status AS orderStatus,
            created_at AS createdAt
     FROM t_sale_bill
     WHERE tenant_id = ? AND business_status NOT IN ('DRAFT', 'VOIDED')
     ORDER BY created_at DESC
     LIMIT ?`,
    [tenantId, limit]
  );

  return records.map((r) => ({
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
  const records = await query<SalesDayTrendRow>(
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

  // 补零成完整连续的最近 N 天：无销售的日期 salesAmount/orderCount 为 0，
  // 避免 GROUP BY 只返回有单日期导致前端曲线缺点、错位
  const keyOf = (v: unknown): string => {
    if (v instanceof Date) {
      const p = (n: number) => String(n).padStart(2, "0");
      return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
    }
    return String(v).slice(0, 10);
  };
  const byDate = new Map(records.map((r) => [keyOf(r.date), r]));
  const result: Array<{ date: string; salesAmount: number; orderCount: number }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const p2 = (n: number) => String(n).padStart(2, "0");
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const key = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    const hit = byDate.get(key);
    result.push({
      date: key,
      salesAmount: hit ? Number(hit.salesAmount) : 0,
      orderCount: hit ? Number(hit.orderCount) : 0,
    });
  }
  return result;
}

// ========== 库存分析 ==========

export async function getInventoryStats(tenantId: string) {
  const stats = await queryOne<InventoryStatsRow>(
    `SELECT
       COALESCE(SUM(ib.physical_qty), 0) AS totalQty,
       COALESCE(SUM(ib.available_qty), 0) AS availableQty,
       COALESCE(SUM(ib.locked_qty), 0) AS lockedQty,
       COUNT(DISTINCT ib.sku_id) AS skuCount,
       COUNT(DISTINCT ib.store_id) AS storeCount
     FROM t_inventory_balance ib
     WHERE ib.tenant_id = ?`,
    [tenantId]
  );

  const valueStats = await queryOne<TotalValueRow>(
    `SELECT COALESCE(SUM(ib.physical_qty * pp.cost_price), 0) AS totalValue
     FROM t_inventory_balance ib
     LEFT JOIN t_product_price pp ON pp.sku_id = ib.sku_id AND pp.tenant_id = ib.tenant_id
     WHERE ib.tenant_id = ?`,
    [tenantId]
  );

  return {
    totalQty: Number(stats?.totalQty ?? 0),
    availableQty: Number(stats?.availableQty ?? 0),
    lockedQty: Number(stats?.lockedQty ?? 0),
    skuCount: Number(stats?.skuCount ?? 0),
    storeCount: Number(stats?.storeCount ?? 0),
    totalValue: Number(valueStats?.totalValue ?? 0),
  };
}

export async function getInventoryTurnover(tenantId: string) {
  const records = await query<InventoryTurnoverRow>(
    `SELECT DATE_FORMAT(sb.created_at, '%Y-%m') AS month,
            COALESCE(SUM(sbi.total_bottle_qty), 0) AS soldQty,
            COALESCE(SUM(sbi.subtotal_amount), 0) AS soldAmount
     FROM t_sale_bill_item sbi
     JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND sb.tenant_id = ?
       AND sb.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
     GROUP BY DATE_FORMAT(sb.created_at, '%Y-%m')
     ORDER BY month ASC`,
    [tenantId]
  );

  const avgInventory = await queryOne<AvgInventoryRow>(
    `SELECT COALESCE(AVG(total_qty), 0) AS avgQty
     FROM (
       SELECT COALESCE(SUM(ib.physical_qty), 0) AS total_qty
       FROM t_inventory_balance ib
       WHERE ib.tenant_id = ?
       GROUP BY ib.store_id, ib.sku_id
     ) AS sub`,
    [tenantId]
  );

  const avgQty = Number(avgInventory?.avgQty ?? 0);

  return records.map((r) => {
    const soldQty = Number(r.soldQty);
    const turnoverRate = avgQty > 0 ? Math.round((soldQty / avgQty) * 10000) / 100 : 0;
    return {
      month: r.month,
      soldQty,
      soldAmount: Number(r.soldAmount),
      turnoverRate,
    };
  });
}

export async function getInventoryWarningList(tenantId: string) {
  const records = await query<InventoryWarningListRow>(
    `SELECT sw.sku_name AS skuName,
            sw.current_stock AS currentStock,
            sw.warning_threshold AS warningThreshold,
            sw.warning_level AS warningLevel,
            sw.store_name AS storeName
     FROM t_stock_warning sw
     WHERE sw.tenant_id = ? AND sw.status = 'ACTIVE'
     ORDER BY CASE sw.warning_level WHEN 'URGENT' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END
     LIMIT 10`,
    [tenantId]
  );

  return records.map((r) => ({
    skuName: r.skuName,
    currentStock: Number(r.currentStock),
    warningThreshold: Number(r.warningThreshold),
    warningLevel: r.warningLevel,
    storeName: r.storeName,
  }));
}

export async function getInventoryValueAnalysis(tenantId: string) {
  const records = await query<InventoryValueAnalysisRow>(
    `SELECT pc.name AS categoryName,
            COUNT(DISTINCT ib.sku_id) AS skuCount,
            COALESCE(SUM(ib.physical_qty), 0) AS totalQty,
            COALESCE(SUM(ib.physical_qty * pp.cost_price), 0) AS totalValue
     FROM t_inventory_balance ib
     LEFT JOIN t_product_price pp ON pp.sku_id = ib.sku_id AND pp.tenant_id = ib.tenant_id
     LEFT JOIN t_product_sku ps ON ps.id = ib.sku_id AND ps.tenant_id = ib.tenant_id
     LEFT JOIN t_product_spu psp ON psp.id = ps.spu_id AND psp.tenant_id = ps.tenant_id
     LEFT JOIN t_product_category pc ON pc.id = psp.category_id
     WHERE ib.tenant_id = ? AND ib.physical_qty > 0
     GROUP BY pc.name
     ORDER BY totalValue DESC
     LIMIT 10`,
    [tenantId]
  );

  const totalValue = records.reduce((sum: number, r) => sum + Number(r.totalValue), 0);

  return records.map((r) => ({
    categoryName: r.categoryName || '未分类',
    skuCount: Number(r.skuCount),
    totalQty: Number(r.totalQty),
    totalValue: Number(r.totalValue),
    percentage: totalValue > 0 ? Math.round((Number(r.totalValue) / totalValue) * 10000) / 100 : 0,
  }));
}

// ========== 客户分析 ==========

export async function getCustomerStats(tenantId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const stats = await queryOne<CustomerStatsRow>(
    `SELECT
       COUNT(*) AS totalCount,
       COALESCE(SUM(CASE WHEN DATE(created_at) = ? THEN 1 END), 0) AS todayNewCount,
       COALESCE(SUM(CASE WHEN DATE(created_at) BETWEEN ? AND ? THEN 1 END), 0) AS monthlyNewCount,
       COALESCE(SUM(CASE WHEN customer_type = 'WHOLESALE' THEN 1 END), 0) AS wholesaleCount,
       COALESCE(SUM(CASE WHEN customer_type = 'RETAIL' THEN 1 END), 0) AS retailCount,
       COALESCE(SUM(CASE WHEN status = 1 THEN 1 END), 0) AS activeCount
     FROM t_member
     WHERE tenant_id = ?`,
    [today, thirtyDaysAgo, today, tenantId]
  );

  return {
    totalCount: Number(stats?.totalCount ?? 0),
    todayNewCount: Number(stats?.todayNewCount ?? 0),
    monthlyNewCount: Number(stats?.monthlyNewCount ?? 0),
    wholesaleCount: Number(stats?.wholesaleCount ?? 0),
    retailCount: Number(stats?.retailCount ?? 0),
    activeCount: Number(stats?.activeCount ?? 0),
  };
}

export async function getCustomerGrowthTrend(tenantId: string) {
  const records = await query<CustomerGrowthRow>(
    `SELECT DATE_FORMAT(m.created_at, '%Y-%m') AS month,
            COUNT(*) AS newCustomers,
            SUM(CASE WHEN m.status = 1 THEN 1 ELSE 0 END) AS activeCustomers
     FROM t_member m
     WHERE m.tenant_id = ? AND m.created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
     GROUP BY DATE_FORMAT(m.created_at, '%Y-%m')
     ORDER BY month ASC`,
    [tenantId]
  );

  return records.map((r) => ({
    month: r.month,
    newCustomers: Number(r.newCustomers),
    activeCustomers: Number(r.activeCustomers),
  }));
}

export async function getCustomerActivity(tenantId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);

  const active30Days = await queryOne<CountRow>(
    `SELECT COUNT(DISTINCT sb.customer_id) AS count
     FROM t_sale_bill sb
     WHERE sb.tenant_id = ? AND sb.customer_id IS NOT NULL
       AND sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(sb.created_at) >= ?`,
    [tenantId, thirtyDaysAgo]
  );

  const active60Days = await queryOne<CountRow>(
    `SELECT COUNT(DISTINCT sb.customer_id) AS count
     FROM t_sale_bill sb
     WHERE sb.tenant_id = ? AND sb.customer_id IS NOT NULL
       AND sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(sb.created_at) >= ? AND DATE(sb.created_at) < ?`,
    [tenantId, sixtyDaysAgo, thirtyDaysAgo]
  );

  const avgOrderAmount = await queryOne<AvgAmountRow>(
    `SELECT COALESCE(AVG(sb.receivable_amount), 0) AS avgAmount
     FROM t_sale_bill sb
     WHERE sb.tenant_id = ? AND sb.customer_id IS NOT NULL
       AND sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(sb.created_at) >= ?`,
    [tenantId, thirtyDaysAgo]
  );

  return {
    active30DaysCount: Number(active30Days?.count ?? 0),
    active60DaysCount: Number(active60Days?.count ?? 0),
    avgOrderAmount: Number(avgOrderAmount?.avgAmount ?? 0),
    retentionRate: Number(active60Days?.count ?? 0) > 0
      ? Math.round((Number(active30Days?.count ?? 0) / Number(active60Days?.count ?? 0)) * 10000) / 100
      : 0,
  };
}

export async function getCustomerCategoryStats(tenantId: string) {
  const records = await query<CustomerCategoryRow>(
    `SELECT m.customer_type AS customerType,
            COUNT(*) AS customerCount,
            COALESCE(SUM(sb.receivable_amount), 0) AS totalAmount,
            COUNT(DISTINCT sb.bill_no) AS orderCount
     FROM t_member m
     LEFT JOIN t_sale_bill sb ON sb.customer_id = m.id AND sb.tenant_id = m.tenant_id
                              AND sb.business_status NOT IN ('DRAFT', 'VOIDED')
     WHERE m.tenant_id = ?
     GROUP BY m.customer_type`,
    [tenantId]
  );

  return records.map((r) => ({
    customerType: r.customerType,
    customerTypeLabel: r.customerType === 'WHOLESALE' ? '批发客户' : r.customerType === 'RETAIL' ? '零售客户' : '其他',
    customerCount: Number(r.customerCount),
    totalAmount: Number(r.totalAmount),
    orderCount: Number(r.orderCount),
  }));
}

// ========== 供应商分析 ==========

export async function getSupplierStats(tenantId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const stats = await queryOne<SupplierStatsRow>(
    `SELECT
       COUNT(*) AS totalCount,
       COALESCE(SUM(CASE WHEN DATE(created_at) BETWEEN ? AND ? THEN 1 END), 0) AS monthlyNewCount,
       COALESCE(SUM(CASE WHEN status = 1 THEN 1 END), 0) AS activeCount
     FROM t_supplier
     WHERE tenant_id = ?`,
    [thirtyDaysAgo, today, tenantId]
  );

  const purchaseStats = await queryOne<SupplierPurchaseStatsRow>(
    `SELECT
       COUNT(DISTINCT po.supplier_id) AS activeSupplierCount,
       COALESCE(SUM(po.payable_amount), 0) AS totalPurchaseAmount,
       COUNT(DISTINCT po.order_no) AS purchaseOrderCount
     FROM t_purchase_order po
     WHERE po.tenant_id = ? AND po.order_status NOT IN ('DRAFT', 'CANCELLED')
       AND DATE(po.created_at) >= ?`,
    [tenantId, thirtyDaysAgo]
  );

  return {
    totalCount: Number(stats?.totalCount ?? 0),
    monthlyNewCount: Number(stats?.monthlyNewCount ?? 0),
    activeCount: Number(stats?.activeCount ?? 0),
    activeSupplierCount: Number(purchaseStats?.activeSupplierCount ?? 0),
    totalPurchaseAmount: Number(purchaseStats?.totalPurchaseAmount ?? 0),
    purchaseOrderCount: Number(purchaseStats?.purchaseOrderCount ?? 0),
  };
}

export async function getSupplierPurchaseRanking(tenantId: string, dateStart: string, dateEnd: string) {
  const records = await query<SupplierRankingRow>(
    `SELECT s.id AS supplierId, s.name AS supplierName,
            COUNT(DISTINCT po.order_no) AS orderCount,
            COALESCE(SUM(po.payable_amount), 0) AS totalAmount,
            COALESCE(SUM(po.paid_amount), 0) AS paidAmount
     FROM t_supplier s
     LEFT JOIN t_purchase_order po ON po.supplier_id = s.id AND po.tenant_id = s.tenant_id
                                   AND po.order_status NOT IN ('DRAFT', 'CANCELLED')
                                   AND DATE(po.created_at) BETWEEN ? AND ?
     WHERE s.tenant_id = ?
     GROUP BY s.id, s.name
     ORDER BY totalAmount DESC
     LIMIT 10`,
    [dateStart, dateEnd, tenantId]
  );

  return records.map((r) => ({
    supplierId: r.supplierId,
    supplierName: r.supplierName,
    orderCount: Number(r.orderCount),
    totalAmount: Number(r.totalAmount),
    paidAmount: Number(r.paidAmount),
  }));
}

export async function getSupplierOnTimeRate(tenantId: string) {
  const records = await query<SupplierOnTimeRow>(
    `SELECT s.name AS supplierName,
            COUNT(*) AS totalOrders,
            SUM(CASE WHEN po.actual_date <= po.expected_date THEN 1 ELSE 0 END) AS onTimeOrders,
            SUM(CASE WHEN po.actual_date > po.expected_date THEN 1 ELSE 0 END) AS delayedOrders
     FROM t_supplier s
     LEFT JOIN t_purchase_order po ON po.supplier_id = s.id AND po.tenant_id = s.tenant_id
                                   AND po.order_status = 'COMPLETED'
                                   AND po.expected_date IS NOT NULL AND po.actual_date IS NOT NULL
     WHERE s.tenant_id = ?
     GROUP BY s.name
     HAVING totalOrders > 0
     ORDER BY totalOrders DESC
     LIMIT 10`,
    [tenantId]
  );

  return records.map((r) => {
    const totalOrders = Number(r.totalOrders);
    const onTimeOrders = Number(r.onTimeOrders);
    return {
      supplierName: r.supplierName,
      totalOrders,
      onTimeOrders,
      delayedOrders: Number(r.delayedOrders),
      onTimeRate: totalOrders > 0 ? Math.round((onTimeOrders / totalOrders) * 10000) / 100 : 0,
    };
  });
}

export async function getSupplierTrend(tenantId: string) {
  const records = await query<SupplierTrendRow>(
    `SELECT DATE_FORMAT(po.created_at, '%Y-%m') AS month,
            COUNT(DISTINCT po.supplier_id) AS activeSupplierCount,
            COALESCE(SUM(po.payable_amount), 0) AS totalAmount,
            COUNT(DISTINCT po.order_no) AS orderCount
     FROM t_purchase_order po
     WHERE po.tenant_id = ? AND po.order_status NOT IN ('DRAFT', 'CANCELLED')
       AND po.created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
     GROUP BY DATE_FORMAT(po.created_at, '%Y-%m')
     ORDER BY month ASC`,
    [tenantId]
  );

  return records.map((r) => ({
    month: r.month,
    activeSupplierCount: Number(r.activeSupplierCount),
    totalAmount: Number(r.totalAmount),
    orderCount: Number(r.orderCount),
  }));
}

// ========== 销售排行 - 员工 ==========

export async function getTopEmployees(tenantId: string, dateStart: string, dateEnd: string) {
  const records = await query<TopEmployeeRow>(
    `SELECT sb.operator_id AS employeeId, u.real_name AS employeeName,
            COUNT(DISTINCT sb.bill_no) AS orderCount,
            COALESCE(SUM(sb.receivable_amount), 0) AS totalAmount,
            COALESCE(SUM(sb.received_amount), 0) AS receivedAmount
     FROM t_sale_bill sb
     LEFT JOIN t_sys_user u ON u.id = sb.operator_id
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND sb.tenant_id = ?
       AND sb.operator_id IS NOT NULL
       AND DATE(sb.created_at) BETWEEN ? AND ?
     GROUP BY sb.operator_id, u.real_name
     ORDER BY totalAmount DESC
     LIMIT 10`,
    [tenantId, dateStart, dateEnd]
  );

  return records.map((r) => ({
    employeeId: r.employeeId,
    employeeName: r.employeeName || '未知员工',
    orderCount: Number(r.orderCount),
    totalAmount: Number(r.totalAmount),
    receivedAmount: Number(r.receivedAmount),
  }));
}