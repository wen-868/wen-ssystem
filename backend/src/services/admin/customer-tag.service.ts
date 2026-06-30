import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

// ===== 标签管理 =====
export async function listTags(tenantId: string) {
  return queryWithTenant<any>(
    `SELECT ct.id, ct.tag_name AS tagName, ct.tag_type AS tagType, ct.tag_group AS tagGroup,
            COUNT(ctr.id) AS customerCount
     FROM customer_tag ct
     LEFT JOIN customer_tag_relation ctr ON ctr.tag_id = ct.id AND ctr.tenant_id = ct.tenant_id
     WHERE ct.tenant_id = ?
     GROUP BY ct.id, ct.tag_name, ct.tag_type, ct.tag_group
     ORDER BY ct.id`,
    [tenantId], tenantId
  );
}

export async function createTag(params: { tagName: string; tagType: string; tagGroup?: string; tenantId: string }) {
  const { tagName, tagType, tagGroup, tenantId } = params;
  const result = await queryWithTenant<any>(
    "INSERT INTO customer_tag (tag_name, tag_type, tag_group, tenant_id) VALUES (?, ?, ?, ?)",
    [tagName, tagType, tagGroup ?? null, tenantId], tenantId
  );
  return { id: (result as any).insertId, tagName, tagType };
}

export async function updateTag(id: number, params: { tagName?: string; tagType?: string; tagGroup?: string; tenantId: string }) {
  const fields: string[] = []; const values: unknown[] = [];
  if (params.tagName !== undefined) { fields.push("tag_name = ?"); values.push(params.tagName); }
  if (params.tagType !== undefined) { fields.push("tag_type = ?"); values.push(params.tagType); }
  if (params.tagGroup !== undefined) { fields.push("tag_group = ?"); values.push(params.tagGroup); }
  if (fields.length === 0) throw new Error("没有需要更新的字段");
  values.push(id, params.tenantId);
  await queryWithTenant<any>(`UPDATE customer_tag SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, params.tenantId);
  return { id, ...params };
}

export async function deleteTag(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM customer_tag_relation WHERE tag_id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  await queryWithTenant("DELETE FROM customer_tag WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { id };
}

// ===== 客户标签关联 =====
export async function addCustomerTag(customerId: number, tagId: number, tenantId: string) {
  await queryWithTenant("INSERT IGNORE INTO customer_tag_relation (customer_id, tag_id, tenant_id) VALUES (?, ?, ?)", [customerId, tagId, tenantId], tenantId);
  return { customerId, tagId };
}

export async function removeCustomerTag(customerId: number, tagId: number, tenantId: string) {
  await queryWithTenant("DELETE FROM customer_tag_relation WHERE customer_id = ? AND tag_id = ? AND tenant_id = ?", [customerId, tagId, tenantId], tenantId);
  return { customerId, tagId };
}

export async function getCustomerTags(customerId: number, tenantId: string) {
  return queryWithTenant<any>(
    `SELECT ct.id, ct.tag_name AS tagName, ct.tag_type AS tagType, ct.tag_group AS tagGroup
     FROM customer_tag_relation ctr
     JOIN customer_tag ct ON ct.id = ctr.tag_id AND ct.tenant_id = ctr.tenant_id
     WHERE ctr.customer_id = ? AND ctr.tenant_id = ?`,
    [customerId, tenantId], tenantId
  );
}

// ===== 客户画像 =====
export async function getCustomerProfile(customerId: number, tenantId: string) {
  let profile = await queryOneWithTenant<any>(
    "SELECT customer_id AS customerId, age_group AS ageGroup, gender, prefer_category AS preferCategory, prefer_brand AS preferBrand, avg_order_amount AS avgOrderAmount, total_order_count AS totalOrderCount, last_order_at AS lastOrderAt, total_points AS totalPoints, member_level AS memberLevel, lifecycle_stage AS lifecycleStage FROM customer_profile WHERE customer_id = ? AND tenant_id = ?",
    [customerId, tenantId], tenantId
  );
  if (!profile) {
    await queryWithTenant("INSERT INTO customer_profile (customer_id, lifecycle_stage, tenant_id) VALUES (?, 'PROSPECT', ?)", [customerId, tenantId], tenantId);
    profile = { customerId, ageGroup: null, gender: null, preferCategory: null, preferBrand: null, avgOrderAmount: 0, totalOrderCount: 0, lastOrderAt: null, totalPoints: 0, memberLevel: "VIP1", lifecycleStage: "PROSPECT" };
  }
  const tags = await getCustomerTags(customerId, tenantId);
  const member = await queryOneWithTenant<any>("SELECT name, mobile FROM member WHERE id = ? AND tenant_id = ?", [customerId, tenantId], tenantId);
  const points = await queryOneWithTenant<any>("SELECT total_points AS totalPoints, available_points AS availablePoints FROM customer_points WHERE customer_id = ? AND tenant_id = ?", [customerId, tenantId], tenantId);
  return {
    ...profile,
    name: member?.name ?? "",
    mobile: member?.mobile ?? "",
    availablePoints: points?.availablePoints ?? 0,
    tags
  };
}

// 自动更新画像
export async function updateCustomerProfile(customerId: number, tenantId: string) {
  const stats = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS orderCount, COALESCE(AVG(receivable_amount), 0) AS avgAmount, MAX(created_at) AS lastOrder
     FROM sale_bill WHERE member_id = ? AND tenant_id = ? AND business_status = 'CREATED'`,
    [customerId, tenantId], tenantId
  );
  const points = await queryOneWithTenant<any>("SELECT total_points AS totalPoints FROM customer_points WHERE customer_id = ? AND tenant_id = ?", [customerId, tenantId], tenantId);
  const level = await queryOneWithTenant<any>("SELECT level_name FROM customer_level WHERE customer_id = ? AND tenant_id = ?", [customerId, tenantId], tenantId);
  // 生命周期判定
  let stage = "PROSPECT";
  if (stats?.orderCount > 0) {
    const daysSinceLast = stats.lastOrder ? Math.floor((Date.now() - new Date(stats.lastOrder).getTime()) / 86400000) : 999;
    if (stats.orderCount === 1 && daysSinceLast <= 30) stage = "NEW";
    else if (daysSinceLast <= 30) stage = "ACTIVE";
    else if (daysSinceLast <= 90) stage = "DORMANT";
    else stage = "LOST";
  }
  await queryWithTenant(
    `INSERT INTO customer_profile (customer_id, total_order_count, avg_order_amount, last_order_at, total_points, member_level, lifecycle_stage, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE total_order_count=VALUES(total_order_count), avg_order_amount=VALUES(avg_order_amount), last_order_at=VALUES(last_order_at), total_points=VALUES(total_points), member_level=VALUES(member_level), lifecycle_stage=VALUES(lifecycle_stage)`,
    [customerId, stats?.orderCount ?? 0, stats?.avgAmount ?? 0, stats?.lastOrder ?? null, points?.totalPoints ?? 0, level?.level_name ?? "VIP1", stage, tenantId],
    tenantId
  );
  return { customerId, stage };
}