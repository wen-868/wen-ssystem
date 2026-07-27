import { queryWithTenant } from "../../../shared/db";
import { parseDateParam, getDefaultDateStart, getDefaultDateEnd } from "../../../shared/date-utils";

// ========== 类型定义 ==========

/** 员工业绩排名统计行 */
interface StaffPerformanceRow {
  id: number | string;
  name: string | null;
  orderCount: number | string;
  totalAmount: number | string;
  receivedAmount: number | string;
  totalQty?: number | string;
}

export async function getStaffPerformanceRanking(
  tenantId: string,
  dateStart?: string,
  dateEnd?: string,
  limit: number = 20
) {
  const start = parseDateParam(dateStart, getDefaultDateStart(30));
  const end = parseDateParam(dateEnd, getDefaultDateEnd());
  const lim = Math.min(Number(limit || 20), 100);

  const records = await queryWithTenant<StaffPerformanceRow>(
    `SELECT sb.operator_id AS id, u.real_name AS name,
            COUNT(DISTINCT sb.bill_no) AS orderCount,
            COALESCE(SUM(sb.receivable_amount), 0) AS totalAmount,
            COALESCE(SUM(sb.received_amount), 0) AS receivedAmount
     FROM t_sale_bill sb
     LEFT JOIN t_sys_user u ON u.id = sb.operator_id
     WHERE sb.business_status NOT IN ('DRAFT', 'VOIDED')
       AND DATE(sb.created_at) BETWEEN ? AND ?
     GROUP BY sb.operator_id, u.real_name
     ORDER BY totalAmount DESC
     LIMIT ?`,
    [start, end, lim],
    tenantId
  );

  return records.map((r: StaffPerformanceRow) => ({
    ...r,
    totalQty: Number(r.totalQty ?? 0),
    totalAmount: Number(r.totalAmount ?? 0),
    receivedAmount: Number(r.receivedAmount ?? 0),
    orderCount: Number(r.orderCount ?? 0)
  }));
}
