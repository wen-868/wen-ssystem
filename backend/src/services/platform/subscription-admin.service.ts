/**
 * 平台总后台 - 订阅管理服务
 *
 * 功能：租户订阅套餐管理、订单管理
 */

import { query, queryOne } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

// ─── 订阅管理 ────────────────────────────────────────────────

/**
 * 订阅订单列表
 */
export async function listPlatformSubscriptions(
  page: number,
  pageSize: number,
  filters?: {
    tenantId?: string;
    status?: string;
    planCode?: string;
    keyword?: string;
  }
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filters?.tenantId) {
    conditions.push("s.tenant_id = ?");
    params.push(filters.tenantId);
  }
  if (filters?.status) {
    conditions.push("s.status = ?");
    params.push(filters.status);
  }
  if (filters?.planCode) {
    conditions.push("s.plan_code = ?");
    params.push(filters.planCode);
  }
  if (filters?.keyword) {
    conditions.push("(s.order_no LIKE ? OR t.tenant_name LIKE ?)");
    const like = `%${filters.keyword}%`;
    params.push(like, like);
  }

  const where = conditions.join(" AND ");

  const rows = await query<any[]>(
    `SELECT s.id, s.order_no AS orderNo, s.tenant_id AS tenantId,
            t.tenant_name AS tenantName,
            s.plan_code AS planCode, s.plan_name AS planName,
            s.start_date AS startDate, s.end_date AS endDate,
            s.status, s.amount, s.created_at AS createdAt
     FROM subscription s
     LEFT JOIN tenant t ON t.tenant_id = s.tenant_id
     WHERE ${where}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total
     FROM subscription s
     LEFT JOIN tenant t ON t.tenant_id = s.tenant_id
     WHERE ${where}`,
    params
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records: rows
  };
}

/**
 * 手动创建订阅（赠送/开通）
 */
export async function createPlatformSubscription(
  tenantId: string,
  planCode: string,
  planName: string,
  durationDays: number,
  amount: number,
  operator: string
) {
  const orderNo = makeBizNo("SUB");
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + durationDays);

  const result = await query<any>(
    `INSERT INTO subscription
     (tenant_id, order_no, plan_code, plan_name, start_date, end_date, status, amount, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    [tenantId, orderNo, planCode, planName, startDate, endDate, amount, operator]
  );

  // 同时更新租户过期时间
  await query(
    "UPDATE tenant SET expire_at = ? WHERE tenant_id = ?",
    [endDate, tenantId]
  );

  return {
    id: (result as unknown as { insertId: number }).insertId as number,
    orderNo,
    tenantId,
    planCode,
    endDate
  };
}