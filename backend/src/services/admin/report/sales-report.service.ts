import { z } from "zod";
import { queryWithTenant, queryOneWithTenant } from "../../../shared/db.js";
import { parseDateParam, getDefaultDateStart, getDefaultDateEnd } from "../../../shared/date-utils.js";

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

  const records = await queryWithTenant<any>(
    `SELECT DATE(sb.created_at) AS date,
            COUNT(DISTINCT sb.bill_no) AS orderCount,
            COUNT(DISTINCT sb.customer_id) AS customerCount,
            COALESCE(SUM(sb.receivable_amount), 0) AS salesAmount,
            COALESCE(SUM(sb.received_amount), 0) AS receivedAmount,
            COALESCE(SUM(sb.unreceived_amount), 0) AS unreceivedAmount
     FROM sale_bill sb
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
  const returnRecords = await queryWithTenant<any>(
    `SELECT DATE(sr.created_at) AS date,
            COUNT(DISTINCT sr.return_no) AS returnCount,
            COALESCE(SUM(sr.refund_amount), 0) AS returnAmount
     FROM sale_return sr
     WHERE ${returnWhere}
     GROUP BY DATE(sr.created_at)`,
    returnParams,
    tenantId
  );

  const returnMap = new Map<string, { returnCount: number; returnAmount: number }>();
  for (const r of returnRecords) {
    returnMap.set(r.date, { returnCount: Number(r.returnCount), returnAmount: Number(r.returnAmount) });
  }

  return records.map((r: any) => {
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

  const records = await queryWithTenant<any>(
    `SELECT DATE_FORMAT(sb.created_at, ?) AS period,
            COUNT(DISTINCT sb.bill_no) AS orderCount,
            COALESCE(SUM(sb.receivable_amount), 0) AS salesAmount,
            COALESCE(SUM(sb.received_amount), 0) AS receivedAmount
     FROM sale_bill sb
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND sb.created_at >= DATE_SUB(CURDATE(), INTERVAL ?)
     GROUP BY period
     ORDER BY period ASC`,
    [dateFormat, intervalExpr],
    tenantId
  );

  return records.map((r: any) => ({
    period: r.period,
    orderCount: Number(r.orderCount),
    salesAmount: Number(r.salesAmount),
    receivedAmount: Number(r.receivedAmount)
  }));
}

export async function getSalesRanking(
  tenantId: string,
  dimension: "product" | "customer" | "staff" = "product",
  dateStart?: string,
  dateEnd?: string,
  limit: number = 20
) {
  const dim = z.enum(["product", "customer", "staff"]).parse(dimension);
  const start = parseDateParam(dateStart, getDefaultDateStart(30));
  const end = parseDateParam(dateEnd, getDefaultDateEnd());
  const lim = Math.min(Number(limit || 20), 100);

  let records: any[];

  if (dim === "product") {
    records = await queryWithTenant<any>(
      `SELECT sbi.sku_id AS id, sbi.sku_name AS name,
              SUM(sbi.total_bottle_qty) AS totalQty,
              COALESCE(SUM(sbi.subtotal_amount), 0) AS totalAmount
       FROM sale_bill_item sbi
       JOIN sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id
       WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
         AND DATE(sb.created_at) BETWEEN ? AND ?
       GROUP BY sbi.sku_id, sbi.sku_name
       ORDER BY totalAmount DESC
       LIMIT ?`,
      [start, end, lim],
      tenantId
    );
  } else if (dim === "customer") {
    records = await queryWithTenant<any>(
      `SELECT sb.customer_id AS id, sb.customer_name AS name, sb.customer_mobile AS mobile,
              COUNT(DISTINCT sb.bill_no) AS orderCount,
              COALESCE(SUM(sb.receivable_amount), 0) AS totalAmount,
              COALESCE(SUM(sb.received_amount), 0) AS receivedAmount
       FROM sale_bill sb
       WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
         AND sb.customer_id IS NOT NULL
         AND DATE(sb.created_at) BETWEEN ? AND ?
       GROUP BY sb.customer_id, sb.customer_name, sb.customer_mobile
       ORDER BY totalAmount DESC
       LIMIT ?`,
      [start, end, lim],
      tenantId
    );
  } else {
    records = await queryWithTenant<any>(
      `SELECT sb.operator_id AS id, u.real_name AS name,
              COUNT(DISTINCT sb.bill_no) AS orderCount,
              COALESCE(SUM(sb.receivable_amount), 0) AS totalAmount,
              COALESCE(SUM(sb.received_amount), 0) AS receivedAmount
       FROM sale_bill sb
       LEFT JOIN sys_user u ON u.id = sb.operator_id
       WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
         AND DATE(sb.created_at) BETWEEN ? AND ?
       GROUP BY sb.operator_id, u.real_name
       ORDER BY totalAmount DESC
       LIMIT ?`,
      [start, end, lim],
      tenantId
    );
  }

  return records.map((r: any) => ({
    ...r,
    totalQty: Number(r.totalQty ?? 0),
    totalAmount: Number(r.totalAmount ?? 0),
    receivedAmount: Number(r.receivedAmount ?? 0),
    orderCount: Number(r.orderCount ?? 0)
  }));
}

export async function getBusinessOverview(tenantId: string) {
  const todaySales = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS amount,
            COUNT(*) AS count
     FROM sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(created_at) = CURDATE()`,
    [],
    tenantId
  );

  const yesterdaySales = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS amount,
            COUNT(*) AS count
     FROM sale_bill
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

  const monthSales = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS amount,
            COUNT(*) AS count
     FROM sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
    [],
    tenantId
  );

  const yearSales = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS amount,
            COUNT(*) AS count
     FROM sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE_FORMAT(created_at, '%Y') = DATE_FORMAT(CURDATE(), '%Y')`,
    [],
    tenantId
  );

  const totalReceivable = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(unreceived_amount), 0) AS amount
     FROM sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND unreceived_amount > 0`,
    [],
    tenantId
  );

  const totalPayable = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(unpaid_amount), 0) AS amount
     FROM purchase_order
     WHERE order_status NOT IN ('DRAFT', 'CANCELLED')
       AND unpaid_amount > 0`,
    [],
    tenantId
  );

  const inventoryValue = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(ib.physical_qty * pp.cost_price), 0) AS amount
     FROM inventory_balance ib
     JOIN product_price pp ON pp.sku_id = ib.sku_id AND pp.tenant_id = ib.tenant_id`,
    [],
    tenantId
  );

  const customerCount = await queryOneWithTenant<any>(
    "SELECT COUNT(*) AS count FROM member WHERE status = 1",
    [],
    tenantId
  );

  const supplierCount = await queryOneWithTenant<any>(
    "SELECT COUNT(*) AS count FROM supplier WHERE status = 1",
    [],
    tenantId
  );

  const monthPurchase = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(payable_amount), 0) AS amount,
            COUNT(*) AS count
     FROM purchase_order
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
