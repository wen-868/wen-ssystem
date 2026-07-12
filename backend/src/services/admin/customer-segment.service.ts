import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

export async function createSegment(params: { segmentName: string; conditions: any; autoRefresh?: boolean; tenantId: string }) {
  const { segmentName, conditions, autoRefresh, tenantId } = params;
  const result = await queryWithTenant<any>(
    "INSERT INTO customer_segment (segment_name, conditions, auto_refresh, tenant_id) VALUES (?, ?, ?, ?)",
    [segmentName, JSON.stringify(conditions), autoRefresh ? 1 : 0, tenantId], tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId, segmentName };
}

export async function listSegments(tenantId: string) {
  return queryWithTenant<any>(
    "SELECT id, segment_name AS segmentName, conditions, member_count AS memberCount, auto_refresh AS autoRefresh, updated_at AS updatedAt FROM customer_segment WHERE tenant_id = ? ORDER BY id",
    [tenantId], tenantId
  );
}

export async function updateSegment(id: number, params: { segmentName?: string; conditions?: any; autoRefresh?: boolean; tenantId: string }) {
  const fields: string[] = []; const values: unknown[] = [];
  if (params.segmentName !== undefined) { fields.push("segment_name = ?"); values.push(params.segmentName); }
  if (params.conditions !== undefined) { fields.push("conditions = ?"); values.push(JSON.stringify(params.conditions)); }
  if (params.autoRefresh !== undefined) { fields.push("auto_refresh = ?"); values.push(params.autoRefresh ? 1 : 0); }
  if (fields.length === 0) throw new Error("没有需要更新的字段");
  values.push(id, params.tenantId);
  await queryWithTenant<any>(`UPDATE customer_segment SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, params.tenantId);
  return { id, ...params };
}

export async function deleteSegment(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM customer_segment_member WHERE segment_id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  await queryWithTenant("DELETE FROM customer_segment WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { id };
}

// 条件解析器：将 JSON 条件转为 SQL WHERE
function buildConditionSQL(conditions: any, tenantId: string): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [tenantId];
  if (conditions.minAmount) { clauses.push("cp.avg_order_amount >= ?"); params.push(Number(conditions.minAmount)); }
  if (conditions.maxAmount) { clauses.push("cp.avg_order_amount <= ?"); params.push(Number(conditions.maxAmount)); }
  if (conditions.minOrderCount) { clauses.push("cp.total_order_count >= ?"); params.push(Number(conditions.minOrderCount)); }
  if (conditions.lifecycleStage) { clauses.push("cp.lifecycle_stage = ?"); params.push(conditions.lifecycleStage); }
  if (conditions.memberLevel) { clauses.push("cp.member_level = ?"); params.push(conditions.memberLevel); }
  if (conditions.minPoints) { clauses.push("cp.total_points >= ?"); params.push(Number(conditions.minPoints)); }
  if (conditions.tagIds && conditions.tagIds.length > 0) {
    clauses.push("cp.customer_id IN (SELECT ctr.customer_id FROM customer_tag_relation ctr WHERE ctr.tag_id IN (" + conditions.tagIds.map(() => "?").join(",") + ") AND ctr.tenant_id = ?)");
    params.push(...conditions.tagIds.map(Number), tenantId);
  }
  const sql = clauses.length > 0 ? "AND " + clauses.join(" AND ") : "";
  return { sql, params };
}

// 刷新分群成员
export async function refreshSegmentMembers(segmentId: number, tenantId: string) {
  const segment = await queryOneWithTenant<any>("SELECT id, conditions FROM customer_segment WHERE id = ? AND tenant_id = ?", [segmentId, tenantId], tenantId);
  if (!segment) throw new Error("分群不存在");
  const conditions = typeof segment.conditions === "string" ? JSON.parse(segment.conditions) : segment.conditions;
  const { sql, params } = buildConditionSQL(conditions, tenantId);
  // 清空旧成员
  await queryWithTenant("DELETE FROM customer_segment_member WHERE segment_id = ? AND tenant_id = ?", [segmentId, tenantId], tenantId);
  // 重新匹配
  const members = await queryWithTenant<any>(
    `SELECT cp.customer_id AS customerId FROM customer_profile cp WHERE cp.tenant_id = ? ${sql}`,
    params, tenantId
  );
  for (const m of members) {
    await queryWithTenant("INSERT INTO customer_segment_member (segment_id, customer_id, tenant_id) VALUES (?, ?, ?)", [segmentId, m.customerId, tenantId], tenantId);
  }
  await queryWithTenant("UPDATE customer_segment SET member_count = ? WHERE id = ? AND tenant_id = ?", [members.length, segmentId, tenantId], tenantId);
  return { segmentId, memberCount: members.length };
}

// 分群成员列表
export async function listSegmentMembers(params: { segmentId: number; page: number; pageSize: number; tenantId: string }) {
  const { segmentId, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<any>(
    `SELECT csm.customer_id AS customerId, m.name AS customerName, m.mobile, cp.member_level AS memberLevel, cp.total_points AS totalPoints, cp.lifecycle_stage AS lifecycleStage
     FROM customer_segment_member csm
     LEFT JOIN member m ON m.id = csm.customer_id
     LEFT JOIN customer_profile cp ON cp.customer_id = csm.customer_id AND cp.tenant_id = csm.tenant_id
     WHERE csm.segment_id = ? AND csm.tenant_id = ?
     ORDER BY cp.total_order_count DESC LIMIT ? OFFSET ?`,
    [segmentId, tenantId, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<any>("SELECT COUNT(*) AS total FROM customer_segment_member WHERE segment_id = ? AND tenant_id = ?", [segmentId, tenantId], tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}