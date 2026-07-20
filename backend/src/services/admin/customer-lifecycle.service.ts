import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

// 阶段统计
export async function getLifecycleStages(tenantId: string) {
  const stages = await queryWithTenant<any>(
    `SELECT lifecycle_stage AS stage, COUNT(*) AS customerCount
     FROM t_customer_profile WHERE tenant_id = ?
     GROUP BY lifecycle_stage`,
    [tenantId], tenantId
  );
  return stages;
}

// 转化趋势
export async function getLifecycleTrend(tenantId: string, months: number = 6) {
  const results: any[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const month = new Date();
    month.setMonth(month.getMonth() - i);
    const monthStr = month.toISOString().slice(0, 7);
    const data = await queryWithTenant<any>(
      `SELECT lifecycle_stage AS stage, COUNT(*) AS cnt
       FROM t_customer_profile WHERE tenant_id = ? AND DATE_FORMAT(updated_at, '%Y-%m') = ?
       GROUP BY lifecycle_stage`,
      [tenantId, monthStr], tenantId
    );
    const entry: any = { month: monthStr, PROSPECT: 0, NEW: 0, ACTIVE: 0, DORMANT: 0, LOST: 0 };
    for (const row of data) {
      if (Object.prototype.hasOwnProperty.call(entry, row.stage)) entry[row.stage] = row.cnt;
    }
    results.push(entry);
  }
  return results;
}

// 阶段明细
export async function getLifecycleDetail(params: { stage?: string; page: number; pageSize: number; tenantId: string }) {
  const { stage, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions = ["cp.tenant_id = ?"]; const values: unknown[] = [tenantId];
  if (stage) { conditions.push("cp.lifecycle_stage = ?"); values.push(stage); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<any>(
    `SELECT cp.customer_id AS customerId, m.name AS customerName, m.mobile, cp.lifecycle_stage AS stage, cp.last_order_at AS lastOrderAt, cp.total_order_count AS totalOrderCount, cp.avg_order_amount AS avgOrderAmount, cp.member_level AS memberLevel, DATEDIFF(NOW(), COALESCE(cp.last_order_at, m.created_at)) AS daysSinceLastOrder
     FROM t_customer_profile cp
     LEFT JOIN t_member m ON m.id = cp.customer_id
     ${where} ORDER BY cp.last_order_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS total FROM t_customer_profile cp ${where}`, values, tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}