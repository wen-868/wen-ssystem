import { z } from "zod";
import { queryWithTenant, queryOneWithTenant } from "../../../shared/db.js";
import { parseDateParam, getDefaultDateStart, getDefaultDateEnd } from "../../../shared/date-utils.js";

export async function getReceivablePayable(
  tenantId: string,
  dateStart?: string,
  dateEnd?: string
) {
  const start = dateStart ? parseDateParam(dateStart) : undefined;
  const end = dateEnd ? parseDateParam(dateEnd) : undefined;

  const receivableConditions: string[] = [
    "sb.business_status NOT IN ('DRAFT', 'VOIDED')",
    "sb.customer_id IS NOT NULL",
    "sb.unreceived_amount > 0"
  ];
  const receivableParams: unknown[] = [];
  if (start && end) {
    receivableConditions.push("DATE(sb.created_at) BETWEEN ? AND ?");
    receivableParams.push(start, end);
  }
  const receivableWhere = receivableConditions.join(" AND ");

  const payableConditions: string[] = [
    "po.order_status NOT IN ('DRAFT', 'CANCELLED')",
    "po.unpaid_amount > 0"
  ];
  const payableParams: unknown[] = [];
  if (start && end) {
    payableConditions.push("DATE(po.created_at) BETWEEN ? AND ?");
    payableParams.push(start, end);
  }
  const payableWhere = payableConditions.join(" AND ");

  const receivable = await queryWithTenant<any>(
    `SELECT sb.customer_id AS customerId, sb.customer_name AS customerName,
            sb.customer_mobile AS customerMobile,
            COUNT(DISTINCT sb.bill_no) AS billCount,
            COALESCE(SUM(sb.receivable_amount), 0) AS totalReceivable,
            COALESCE(SUM(sb.received_amount), 0) AS totalReceived,
            COALESCE(SUM(sb.unreceived_amount), 0) AS totalUnreceived
     FROM t_sale_bill sb
     WHERE ${receivableWhere}
     GROUP BY sb.customer_id, sb.customer_name, sb.customer_mobile
     ORDER BY totalUnreceived DESC`,
    receivableParams,
    tenantId
  );

  const payable = await queryWithTenant<any>(
    `SELECT po.supplier_id AS supplierId, po.supplier_name AS supplierName,
            COUNT(DISTINCT po.order_no) AS orderCount,
            COALESCE(SUM(po.payable_amount), 0) AS totalPayable,
            COALESCE(SUM(po.paid_amount), 0) AS totalPaid,
            COALESCE(SUM(po.unpaid_amount), 0) AS totalUnpaid
     FROM t_purchase_order po
     WHERE ${payableWhere}
     GROUP BY po.supplier_id, po.supplier_name
     ORDER BY totalUnpaid DESC`,
    payableParams,
    tenantId
  );

  const totalReceivable = receivable.reduce((sum: number, r: any) => sum + Number(r.totalUnreceived), 0);
  const totalPayable = payable.reduce((sum: number, r: any) => sum + Number(r.totalUnpaid), 0);

  return {
    totalReceivable,
    totalPayable,
    receivableList: receivable.map((r: any) => ({
      ...r,
      billCount: Number(r.billCount),
      totalReceivable: Number(r.totalReceivable),
      totalReceived: Number(r.totalReceived),
      totalUnreceived: Number(r.totalUnreceived)
    })),
    payableList: payable.map((r: any) => ({
      ...r,
      orderCount: Number(r.orderCount),
      totalPayable: Number(r.totalPayable),
      totalPaid: Number(r.totalPaid),
      totalUnpaid: Number(r.totalUnpaid)
    }))
  };
}

export async function getPaymentAnalysis(
  tenantId: string,
  dateStart?: string,
  dateEnd?: string,
  groupBy: "date" | "customer" | "staff" = "date"
) {
  const start = parseDateParam(dateStart, getDefaultDateStart(30));
  const end = parseDateParam(dateEnd, getDefaultDateEnd());
  const g = z.enum(["date", "customer", "staff"]).parse(groupBy);

  let records: any[];

  if (g === "date") {
    records = await queryWithTenant<any>(
      `SELECT DATE(payment_date) AS period,
              COUNT(*) AS paymentCount,
              COALESCE(SUM(amount), 0) AS totalAmount
       FROM t_customer_payment
       WHERE status NOT IN ('VOIDED')
         AND payment_date BETWEEN ? AND ?
       GROUP BY DATE(payment_date)
       ORDER BY period ASC`,
      [start, end],
      tenantId
    );
  } else if (g === "customer") {
    records = await queryWithTenant<any>(
      `SELECT customer_id AS customerId, customer_name AS customerName,
              COUNT(*) AS paymentCount,
              COALESCE(SUM(amount), 0) AS totalAmount
       FROM t_customer_payment
       WHERE status NOT IN ('VOIDED')
         AND payment_date BETWEEN ? AND ?
       GROUP BY customer_id, customer_name
       ORDER BY totalAmount DESC`,
      [start, end],
      tenantId
    );
  } else {
    records = await queryWithTenant<any>(
      `SELECT cp.operator_id AS staffId, u.real_name AS staffName,
              COUNT(*) AS paymentCount,
              COALESCE(SUM(cp.amount), 0) AS totalAmount
       FROM t_customer_payment cp
       LEFT JOIN t_sys_user u ON u.id = cp.operator_id
       WHERE cp.status NOT IN ('VOIDED')
         AND cp.payment_date BETWEEN ? AND ?
       GROUP BY cp.operator_id, u.real_name
       ORDER BY totalAmount DESC`,
      [start, end],
      tenantId
    );
  }

  return records.map((r: any) => ({
    ...r,
    paymentCount: Number(r.paymentCount ?? 0),
    totalAmount: Number(r.totalAmount ?? 0)
  }));
}

export async function getProfit(
  tenantId: string,
  dateStart?: string,
  dateEnd?: string
) {
  const start = parseDateParam(dateStart, getDefaultDateStart(30));
  const end = parseDateParam(dateEnd, getDefaultDateEnd());

  const salesIncome = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS totalAmount
     FROM t_sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [start, end],
    tenantId
  );

  const salesCost = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(sbi.total_bottle_qty * pp.cost_price), 0) AS totalCost
     FROM t_sale_bill_item sbi
     JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id
     JOIN t_product_price pp ON pp.sku_id = sbi.sku_id AND pp.tenant_id = sbi.tenant_id
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(sb.created_at) BETWEEN ? AND ?`,
    [start, end],
    tenantId
  );

  const returnAmount = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(refund_amount), 0) AS totalAmount
     FROM t_sale_return
     WHERE return_status NOT IN ('VOIDED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [start, end],
    tenantId
  );

  const purchaseReturnAmount = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(refund_amount), 0) AS totalAmount
     FROM t_purchase_return
     WHERE return_status NOT IN ('VOIDED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [start, end],
    tenantId
  );

  const income = Number(salesIncome?.totalAmount ?? 0);
  const cost = Number(salesCost?.totalCost ?? 0) - Number(purchaseReturnAmount?.totalAmount ?? 0);
  const returns = Number(returnAmount?.totalAmount ?? 0);
  const grossProfit = income - cost - returns;
  const grossProfitRate = income > 0 ? Math.round((grossProfit / income) * 10000) / 100 : 0;

  const startDate = new Date(start);
  const endDate = new Date(end);
  const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - daysDiff + 1);
  const prevDateStart = prevStart.toISOString().slice(0, 10);
  const prevDateEnd = prevEnd.toISOString().slice(0, 10);

  const prevSalesIncome = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS totalAmount
     FROM t_sale_bill
     WHERE business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [prevDateStart, prevDateEnd],
    tenantId
  );

  const prevSalesCost = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(sbi.total_bottle_qty * pp.cost_price), 0) AS totalCost
     FROM t_sale_bill_item sbi
     JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id
     JOIN t_product_price pp ON pp.sku_id = sbi.sku_id AND pp.tenant_id = sbi.tenant_id
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(sb.created_at) BETWEEN ? AND ?`,
    [prevDateStart, prevDateEnd],
    tenantId
  );

  const prevReturnAmount = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(refund_amount), 0) AS totalAmount
     FROM t_sale_return
     WHERE return_status NOT IN ('VOIDED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [prevDateStart, prevDateEnd],
    tenantId
  );

  const prevPurchaseReturnAmount = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(refund_amount), 0) AS totalAmount
     FROM t_purchase_return
     WHERE return_status NOT IN ('VOIDED')
       AND DATE(created_at) BETWEEN ? AND ?`,
    [prevDateStart, prevDateEnd],
    tenantId
  );

  const prevIncome = Number(prevSalesIncome?.totalAmount ?? 0);
  const prevCost = Number(prevSalesCost?.totalCost ?? 0) - Number(prevPurchaseReturnAmount?.totalAmount ?? 0);
  const prevReturns = Number(prevReturnAmount?.totalAmount ?? 0);
  const prevGrossProfit = prevIncome - prevCost - prevReturns;

  const salesGrowthRate = prevIncome > 0 ? Math.round(((income - prevIncome) / prevIncome) * 10000) / 100 : 0;
  const profitGrowthRate = prevGrossProfit !== 0 ? Math.round(((grossProfit - prevGrossProfit) / Math.abs(prevGrossProfit)) * 10000) / 100 : (grossProfit > 0 ? 100 : 0);

  return {
    dateStart: start,
    dateEnd: end,
    income,
    cost: Math.max(cost, 0),
    returns,
    grossProfit,
    grossProfitRate,
    salesGrowthRate,
    profitGrowthRate,
    prevDateStart,
    prevDateEnd,
    prevIncome,
    prevGrossProfit
  };
}
