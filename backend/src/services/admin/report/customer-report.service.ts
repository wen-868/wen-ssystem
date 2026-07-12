import { queryWithTenant, queryOneWithTenant } from "../../../shared/db";
import { parseDateParam } from "../../../shared/date-utils";

export async function getCustomerContribution(
  tenantId: string,
  page: number = 1,
  pageSize: number = 20,
  dateStart?: string,
  dateEnd?: string
) {
  const p = Math.max(Number(page || 1), 1);
  const ps = Math.max(Number(pageSize || 20), 1);
  const offset = (p - 1) * ps;
  const start = dateStart ? parseDateParam(dateStart) : undefined;
  const end = dateEnd ? parseDateParam(dateEnd) : undefined;

  const conditions: string[] = ["sb.business_status NOT IN ('DRAFT', 'VOIDED')", "sb.customer_id IS NOT NULL"];
  const params: unknown[] = [];

  if (start) {
    conditions.push("DATE(sb.created_at) >= ?");
    params.push(start);
  }
  if (end) {
    conditions.push("DATE(sb.created_at) <= ?");
    params.push(end);
  }

  const where = conditions.join(" AND ");

  const records = await queryWithTenant<any>(
    `SELECT sb.customer_id AS customerId,
            sb.customer_name AS customerName,
            sb.customer_mobile AS customerMobile,
            COUNT(DISTINCT sb.bill_no) AS orderCount,
            COALESCE(SUM(sb.receivable_amount), 0) AS totalAmount,
            COALESCE(SUM(sb.received_amount), 0) AS receivedAmount,
            COALESCE(SUM(sb.unreceived_amount), 0) AS unpaidAmount,
            CASE WHEN COUNT(DISTINCT sb.bill_no) > 0
              THEN SUM(sb.receivable_amount) / COUNT(DISTINCT sb.bill_no)
              ELSE 0
            END AS avgOrderAmount
     FROM t_sale_bill sb
     WHERE ${where}
     GROUP BY sb.customer_id, sb.customer_name, sb.customer_mobile
     ORDER BY totalAmount DESC
     LIMIT ? OFFSET ?`,
    [...params, ps, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(DISTINCT sb.customer_id) AS total
     FROM t_sale_bill sb
     WHERE ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page: p,
    pageSize: ps,
    records: records.map((r: any) => ({
      ...r,
      orderCount: Number(r.orderCount),
      totalAmount: Number(r.totalAmount),
      receivedAmount: Number(r.receivedAmount),
      unpaidAmount: Number(r.unpaidAmount),
      avgOrderAmount: Number(r.avgOrderAmount ?? 0)
    }))
  };
}
