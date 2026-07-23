import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

/** 生命周期阶段统计行（queryWithTenant 用，驼峰别名） */
interface LifecycleStageStatRow {
  stage: string;
  customerCount: number;
}

/** 生命周期趋势行（queryWithTenant 用，驼峰别名） */
interface LifecycleTrendRow {
  stage: string;
  cnt: number;
}

/** 生命周期阶段类型 */
type LifecycleStage = "PROSPECT" | "NEW" | "ACTIVE" | "DORMANT" | "LOST";

/** 生命周期趋势条目 */
interface LifecycleTrendEntry {
  month: string;
  PROSPECT: number;
  NEW: number;
  ACTIVE: number;
  DORMANT: number;
  LOST: number;
}

/** 生命周期明细行（queryWithTenant 用，驼峰别名，含 JOIN） */
interface LifecycleDetailRow {
  customerId: number | string;
  customerName: string | null;
  mobile: string | null;
  stage: string;
  lastOrderAt: string | Date | null;
  totalOrderCount: number | string;
  avgOrderAmount: number | string | null;
  memberLevel: string | null;
  daysSinceLastOrder: number | string | null;
}

/** COUNT(*) AS total 通用行 */
interface CountTotalRow {
  total: number;
}

// 阶段统计
export async function getLifecycleStages(tenantId: string) {
  const stages = await queryWithTenant<LifecycleStageStatRow>(
    `SELECT lifecycle_stage AS stage, COUNT(*) AS customerCount
     FROM t_customer_profile WHERE tenant_id = ?
     GROUP BY lifecycle_stage`,
    [tenantId], tenantId
  );
  return stages;
}

// 转化趋势
export async function getLifecycleTrend(tenantId: string, months: number = 6) {
  const results: LifecycleTrendEntry[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const month = new Date();
    month.setMonth(month.getMonth() - i);
    const monthStr = month.toISOString().slice(0, 7);
    const data = await queryWithTenant<LifecycleTrendRow>(
      `SELECT lifecycle_stage AS stage, COUNT(*) AS cnt
       FROM t_customer_profile WHERE tenant_id = ? AND DATE_FORMAT(updated_at, '%Y-%m') = ?
       GROUP BY lifecycle_stage`,
      [tenantId, monthStr], tenantId
    );
    const entry: LifecycleTrendEntry = { month: monthStr, PROSPECT: 0, NEW: 0, ACTIVE: 0, DORMANT: 0, LOST: 0 };
    for (const row of data) {
      if (Object.prototype.hasOwnProperty.call(entry, row.stage)) {
        (entry as unknown as Record<string, unknown>)[row.stage as LifecycleStage] = row.cnt;
      }
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
  const records = await queryWithTenant<LifecycleDetailRow>(
    `SELECT cp.customer_id AS customerId, m.name AS customerName, m.mobile, cp.lifecycle_stage AS stage, cp.last_order_at AS lastOrderAt, cp.total_order_count AS totalOrderCount, cp.avg_order_amount AS avgOrderAmount, cp.member_level AS memberLevel, DATEDIFF(NOW(), COALESCE(cp.last_order_at, m.created_at)) AS daysSinceLastOrder
     FROM t_customer_profile cp
     LEFT JOIN t_member m ON m.id = cp.customer_id
     ${where} ORDER BY cp.last_order_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<CountTotalRow>(`SELECT COUNT(*) AS total FROM t_customer_profile cp ${where}`, values, tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}