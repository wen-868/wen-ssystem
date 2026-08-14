import { z } from "zod";
import { queryWithTenant, queryOneWithTenant } from "../../../shared/db";
import { parseDateParam, getDefaultDateStart, getDefaultDateEnd } from "../../../shared/date-utils";

// ========== 类型定义 ==========

/** 销售日统计行 */
interface SalesDailyRow {
  date: string;
  orderCount: number | string;
  customerCount: number | string;
  salesAmount: number | string;
  receivedAmount: number | string;
  unreceivedAmount: number | string;
}

/** 销售退货日统计行 */
interface SalesReturnDailyRow {
  date: string;
  returnCount: number | string;
  returnAmount: number | string;
}

/** 销售趋势统计行 */
interface SalesTrendRow {
  period: string;
  orderCount: number | string;
  salesAmount: number | string;
  receivedAmount: number | string;
}

/** 销售排名统计行（按商品/客户/员工的并集字段） */
interface SalesRankingRow {
  id: number | string;
  name: string;
  mobile?: string;
  totalQty?: number | string;
  orderCount?: number | string;
  totalAmount: number | string;
  receivedAmount?: number | string;
  lastOrderTime?: string | Date;
}

/** 时段热力图行 */
interface SalesHourlyHeatmapRow {
  day: string | Date;
  hour: number | string;
  amount: number | string;
  count: number | string;
}

/** 金额+笔数统计行 */
interface AmountCountRow {
  amount: number | string;
  count: number | string;
}

/** 仅金额统计行 */
interface AmountRow {
  amount: number | string;
}

/** 仅数量统计行 */
interface CountRow {
  count: number | string;
}

export async function getSalesDaily(
  tenantId: string,
  dateStart?: string,
  dateEnd?: string,
  storeId?: number
) {
  const start = parseDateParam(dateStart, getDefaultDateStart(30));
  const end = parseDateParam(dateEnd, getDefaultDateEnd());

  const conditions: string[] = ["sb.business_status NOT IN ('DRAFT', 'VOIDED')", "DATE(sb.created_at) BETWEEN ? AND ?"];
  const params: unknown[] = [start, end];
  if (storeId) {
    conditions.push("sb.store_id = ?");
    params.push(storeId);
  }
  const where = conditions.join(" AND ");

  const records = await queryWithTenant<SalesDailyRow>(
    `SELECT DATE(sb.created_at) AS date,
            COUNT(DISTINCT sb.bill_no) AS orderCount,
            COUNT(DISTINCT sb.customer_id) AS customerCount,
            COALESCE(SUM(sb.receivable_amount), 0) AS salesAmount,
            COALESCE(SUM(sb.received_amount), 0) AS receivedAmount,
            COALESCE(SUM(sb.unreceived_amount), 0) AS unreceivedAmount
     FROM t_sale_bill sb
     WHERE ${where}
     GROUP BY DATE(sb.created_at)
     ORDER BY date ASC`,
    params,
    tenantId
  );

  const returnConditions: string[] = ["sr.return_status NOT IN ('VOIDED')", "DATE(sr.created_at) BETWEEN ? AND ?"];
  const returnParams: unknown[] = [start, end];
  if (storeId) {
    returnConditions.push("sr.store_id = ?");
    returnParams.push(storeId);
  }
  const returnWhere = returnConditions.join(" AND ");
  const returnRecords = await queryWithTenant<SalesReturnDailyRow>(
    `SELECT DATE(sr.created_at) AS date,
            COUNT(DISTINCT sr.return_no) AS returnCount,
            COALESCE(SUM(sr.refund_amount), 0) AS returnAmount
     FROM t_sale_return sr
     WHERE ${returnWhere}
     GROUP BY DATE(sr.created_at)`,
    returnParams,
    tenantId
  );

  const returnMap = new Map<string, { returnCount: number; returnAmount: number }>();
  for (const r of returnRecords) {
    returnMap.set(r.date, { returnCount: Number(r.returnCount), returnAmount: Number(r.returnAmount) });
  }

  return records.map((r: SalesDailyRow) => {
    const ret = returnMap.get(r.date) || { returnCount: 0, returnAmount: 0 };
    const orderCount = Number(r.orderCount);
    const salesAmount = Number(r.salesAmount);
    return {
      date: r.date,
      orderCount,
      customerCount: Number(r.customerCount),
      avgOrderAmount: orderCount > 0 ? Math.round((salesAmount / orderCount) * 100) / 100 : 0,
      salesAmount,
      receivedAmount: Number(r.receivedAmount),
      unreceivedAmount: Number(r.unreceivedAmount),
      returnCount: ret.returnCount,
      returnAmount: ret.returnAmount
    };
  });
}

export async function getSalesTrend(
  tenantId: string,
  granularity: "month" | "week" | "day" = "month"
) {
  const g = z.enum(["month", "week", "day"]).parse(granularity);

  const formatMap: Record<string, { dateFormat: string; intervalExpr: string }> = {
    month: { dateFormat: "%Y-%m", intervalExpr: "12 MONTH" },
    week: { dateFormat: "%Y-%u", intervalExpr: "12 WEEK" },
    day: { dateFormat: "%Y-%m-%d", intervalExpr: "30 DAY" }
  };
  const { dateFormat, intervalExpr } = formatMap[g];

  const records = await queryWithTenant<SalesTrendRow>(
    `SELECT DATE_FORMAT(sb.created_at, ?) AS period,
            COUNT(DISTINCT sb.bill_no) AS orderCount,
            COALESCE(SUM(sb.receivable_amount), 0) AS salesAmount,
            COALESCE(SUM(sb.received_amount), 0) AS receivedAmount
     FROM t_sale_bill sb
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND sb.created_at >= DATE_SUB(CURDATE(), INTERVAL ${intervalExpr})
     GROUP BY period
     ORDER BY period ASC`,
    [dateFormat],
    tenantId
  );

  return records.map((r: SalesTrendRow) => ({
    period: r.period,
    orderCount: Number(r.orderCount),
    salesAmount: Number(r.salesAmount),
    receivedAmount: Number(r.receivedAmount)
  }));
}

/**
 * 时段热力图（近30天，按日 x 小时聚合销售金额）
 * 供销售分析页「时段热力图」Tab 使用，替代前端随机数
 */
export async function getSalesHourlyHeatmap(
  tenantId: string,
  dateStart?: string,
  dateEnd?: string,
  storeId?: number
) {
  const start = parseDateParam(dateStart, getDefaultDateStart(30));
  const end = parseDateParam(dateEnd, getDefaultDateEnd());
  const conditions: string[] = ["sb.business_status NOT IN ('DRAFT', 'VOIDED')", "DATE(sb.created_at) BETWEEN ? AND ?"];
  const params: unknown[] = [start, end];
  if (storeId) {
    conditions.push("sb.store_id = ?");
    params.push(storeId);
  }
  const where = conditions.join(" AND ");

  const rows = await queryWithTenant<SalesHourlyHeatmapRow>(
    `SELECT DATE(sb.created_at) AS day, HOUR(sb.created_at) AS hour,
            COALESCE(SUM(sb.receivable_amount), 0) AS amount,
            COUNT(DISTINCT sb.bill_no) AS count
     FROM t_sale_bill sb
     WHERE ${where}
     GROUP BY DATE(sb.created_at), HOUR(sb.created_at)
     ORDER BY day ASC, hour ASC`,
    params,
    tenantId
  );

  // 生成连续日期轴
  const days: string[] = [];
  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
  const cursor = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  while (cursor <= endDate) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const data: [number, number, number][] = rows.map((r) => {
    const dayStr = r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10);
    return [dayIndex.get(dayStr) ?? 0, Number(r.hour), Number(r.amount)];
  });

  return { days, hours, data };
}

export async function getSalesRanking(
  tenantId: string,
  dimension: "product" | "customer" | "staff" | "store" = "product",
  dateStart?: string,
  dateEnd?: string,
  limit: number = 20
) {
  const dim = z.enum(["product", "customer", "staff", "store"]).parse(dimension);
  const start = parseDateParam(dateStart, getDefaultDateStart(30));
  const end = parseDateParam(dateEnd, getDefaultDateEnd());
  // limit 有默认值 20，无需 || 20
  const lim = Math.min(limit, 100);

  let records: SalesRankingRow[];

  if (dim === "product") {
    records = await queryWithTenant<SalesRankingRow>(
      `SELECT sbi.sku_id AS id, sbi.sku_name AS name,
              SUM(sbi.total_bottle_qty) AS totalQty,
              COALESCE(SUM(sbi.subtotal_amount), 0) AS totalAmount
       FROM t_sale_bill_item sbi
       JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id
       WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
         AND DATE(sb.created_at) BETWEEN ? AND ?
       GROUP BY sbi.sku_id, sbi.sku_name
       ORDER BY totalAmount DESC
       LIMIT ?`,
      [start, end, lim],
      tenantId
    );
  } else if (dim === "customer") {
    records = await queryWithTenant<SalesRankingRow>(
      `SELECT sb.customer_id AS id, sb.customer_name AS name, sb.customer_mobile AS mobile,
              COUNT(DISTINCT sb.bill_no) AS orderCount,
              COALESCE(SUM(sb.receivable_amount), 0) AS totalAmount,
              COALESCE(SUM(sb.received_amount), 0) AS receivedAmount,
              MAX(sb.created_at) AS lastOrderTime
       FROM t_sale_bill sb
       WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
         AND sb.customer_id IS NOT NULL
         AND DATE(sb.created_at) BETWEEN ? AND ?
       GROUP BY sb.customer_id, sb.customer_name, sb.customer_mobile
       ORDER BY totalAmount DESC
       LIMIT ?`,
      [start, end, lim],
      tenantId
    );
  } else if (dim === "store") {
    records = await queryWithTenant<SalesRankingRow>(
      `SELECT sb.store_id AS id, s.name AS name,
              COUNT(DISTINCT sb.bill_no) AS orderCount,
              COALESCE(SUM(sb.receivable_amount), 0) AS totalAmount,
              COALESCE(SUM(sb.received_amount), 0) AS receivedAmount
       FROM t_sale_bill sb
       LEFT JOIN t_store s ON s.id = sb.store_id
       WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
         AND sb.store_id IS NOT NULL
         AND DATE(sb.created_at) BETWEEN ? AND ?
       GROUP BY sb.store_id, s.name
       ORDER BY totalAmount DESC
       LIMIT ?`,
      [start, end, lim],
      tenantId
    );
  } else {
    records = await queryWithTenant<SalesRankingRow>(
      `SELECT sb.operator_id AS id, u.real_name AS name,
              COUNT(DISTINCT sb.bill_no) AS orderCount,
              COALESCE(SUM(sb.receivable_amount), 0) AS totalAmount,
              COALESCE(SUM(sb.received_amount), 0) AS receivedAmount
       FROM t_sale_bill sb
       LEFT JOIN t_sys_user u ON u.id = sb.operator_id
       WHERE sb.tenant_id = ?
         AND sb.business_status NOT IN ('DRAFT', 'VOIDED')
         AND DATE(sb.created_at) BETWEEN ? AND ?
       GROUP BY sb.operator_id, u.real_name
       ORDER BY totalAmount DESC
       LIMIT ?`,
      [tenantId, start, end, lim],
      tenantId
    );
  }

  return records.map((r: SalesRankingRow) => ({
    ...r,
    totalQty: Number(r.totalQty ?? 0),
    totalAmount: Number(r.totalAmount ?? 0),
    receivedAmount: Number(r.receivedAmount ?? 0),
    orderCount: Number(r.orderCount ?? 0)
  }));
}

export async function getBusinessOverview(tenantId: string) {
  const todaySales = await queryOneWithTenant<AmountCountRow>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS amount,
            COUNT(*) AS count
     FROM t_sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(created_at) = CURDATE()`,
    [],
    tenantId
  );

  const yesterdaySales = await queryOneWithTenant<AmountCountRow>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS amount,
            COUNT(*) AS count
     FROM t_sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`,
    [],
    tenantId
  );

  const todayAmount = Number(todaySales?.amount ?? 0);
  const todayCount = Number(todaySales?.count ?? 0);
  const yesterdayAmount = Number(yesterdaySales?.amount ?? 0);
  const yesterdayCount = Number(yesterdaySales?.count ?? 0);

  const salesGrowthRate = yesterdayAmount > 0
    ? Math.round(((todayAmount - yesterdayAmount) / yesterdayAmount) * 10000) / 100
    : (todayAmount > 0 ? 100 : 0);
  const orderGrowthRate = yesterdayCount > 0
    ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 10000) / 100
    : (todayCount > 0 ? 100 : 0);

  const monthSales = await queryOneWithTenant<AmountCountRow>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS amount,
            COUNT(*) AS count
     FROM t_sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
    [],
    tenantId
  );

  const yearSales = await queryOneWithTenant<AmountCountRow>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS amount,
            COUNT(*) AS count
     FROM t_sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE_FORMAT(created_at, '%Y') = DATE_FORMAT(CURDATE(), '%Y')`,
    [],
    tenantId
  );

  const totalReceivable = await queryOneWithTenant<AmountRow>(
    `SELECT COALESCE(SUM(unreceived_amount), 0) AS amount
     FROM t_sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND unreceived_amount > 0`,
    [],
    tenantId
  );

  const totalPayable = await queryOneWithTenant<AmountRow>(
    `SELECT COALESCE(SUM(unpaid_amount), 0) AS amount
     FROM t_purchase_order
     WHERE order_status NOT IN ('DRAFT', 'CANCELLED')
       AND unpaid_amount > 0`,
    [],
    tenantId
  );

  const inventoryValue = await queryOneWithTenant<AmountRow>(
    `SELECT COALESCE(SUM(ib.physical_qty * pp.cost_price), 0) AS amount
     FROM t_inventory_balance ib
     JOIN t_product_price pp ON pp.sku_id = ib.sku_id AND pp.tenant_id = ib.tenant_id`,
    [],
    tenantId
  );

  const customerCount = await queryOneWithTenant<CountRow>(
    "SELECT COUNT(*) AS count FROM t_member WHERE status = 1",
    [],
    tenantId
  );

  const supplierCount = await queryOneWithTenant<CountRow>(
    "SELECT COUNT(*) AS count FROM t_supplier WHERE status = 1",
    [],
    tenantId
  );

  const monthPurchase = await queryOneWithTenant<AmountCountRow>(
    `SELECT COALESCE(SUM(payable_amount), 0) AS amount,
            COUNT(*) AS count
     FROM t_purchase_order
     WHERE order_status NOT IN ('DRAFT', 'CANCELLED')
       AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
    [],
    tenantId
  );

  return {
    todaySalesAmount: todayAmount,
    todayOrderCount: todayCount,
    salesGrowthRate,
    orderGrowthRate,
    monthSalesAmount: Number(monthSales?.amount ?? 0),
    monthOrderCount: Number(monthSales?.count ?? 0),
    yearSalesAmount: Number(yearSales?.amount ?? 0),
    yearOrderCount: Number(yearSales?.count ?? 0),
    totalReceivable: Number(totalReceivable?.amount ?? 0),
    totalPayable: Number(totalPayable?.amount ?? 0),
    inventoryValue: Number(inventoryValue?.amount ?? 0),
    customerCount: Number(customerCount?.count ?? 0),
    supplierCount: Number(supplierCount?.count ?? 0),
    monthPurchaseAmount: Number(monthPurchase?.amount ?? 0),
    monthPurchaseCount: Number(monthPurchase?.count ?? 0)
  };
}
