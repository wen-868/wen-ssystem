import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import type { ResultSetHeader } from "mysql2/promise";

// ===== 类型定义 =====
/** 标签列表（含客户数）查询行 */
interface CustomerTagWithCountRow {
  id: number | string;
  tagName: string;
  tagType: string;
  tagGroup: string | null;
  customerCount: number | string;
}

/** 标签查询行 */
interface CustomerTagRow {
  id: number | string;
  tagName: string;
  tagType: string;
  tagGroup: string | null;
}

/** 客户画像查询行 */
interface CustomerProfileRow {
  customerId: number | string;
  ageGroup: string | null;
  gender: string | null;
  preferCategory: string | null;
  preferBrand: string | null;
  avgOrderAmount: number | string;
  totalOrderCount: number | string;
  lastOrderAt: string | Date | null;
  totalPoints: number | string;
  memberLevel: string | null;
  lifecycleStage: string;
}

/** 会员姓名手机查询行 */
interface MemberNameMobileRow {
  name: string;
  mobile: string | null;
}

/** 客户积分查询行 */
interface CustomerPointsRow {
  totalPoints: number | string;
  availablePoints: number | string;
}

/** 客户订单统计行 */
interface CustomerOrderStatsRow {
  orderCount: number | string;
  avgAmount: number | string | null;
  lastOrder: string | Date | null;
}

/** 客户总积分查询行 */
interface CustomerTotalPointsRow {
  totalPoints: number | string;
}

/** 客户等级查询行 */
interface CustomerLevelRow {
  level_name: string;
}

// ===== 标签管理 =====
export async function listTags(tenantId: string) {
  return queryWithTenant<CustomerTagWithCountRow>(
    `SELECT ct.id, ct.tag_name AS tagName, ct.tag_type AS tagType, ct.tag_group AS tagGroup,
            COUNT(ctr.id) AS customerCount
     FROM t_customer_tag ct
     LEFT JOIN t_customer_tag_relation ctr ON ctr.tag_id = ct.id AND ctr.tenant_id = ct.tenant_id
     WHERE ct.tenant_id = ?
     GROUP BY ct.id, ct.tag_name, ct.tag_type, ct.tag_group
     ORDER BY ct.id`,
    [tenantId], tenantId
  );
}

export async function createTag(params: { tagName: string; tagType: string; tagGroup?: string; tenantId: string }) {
  const { tagName, tagType, tagGroup, tenantId } = params;
  const result = await queryWithTenant<ResultSetHeader>(
    "INSERT INTO t_customer_tag (tag_name, tag_type, tag_group, tenant_id) VALUES (?, ?, ?, ?)",
    [tagName, tagType, tagGroup ?? null, tenantId], tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId, tagName, tagType };
}

export async function updateTag(id: number, params: { tagName?: string; tagType?: string; tagGroup?: string; tenantId: string }) {
  const fields: string[] = []; const values: unknown[] = [];
  if (params.tagName !== undefined) { fields.push("tag_name = ?"); values.push(params.tagName); }
  if (params.tagType !== undefined) { fields.push("tag_type = ?"); values.push(params.tagType); }
  if (params.tagGroup !== undefined) { fields.push("tag_group = ?"); values.push(params.tagGroup); }
  if (fields.length === 0) throw new Error("没有需要更新的字段");
  values.push(id, params.tenantId);
  await queryWithTenant<ResultSetHeader>(`UPDATE t_customer_tag SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, params.tenantId);
  return { id, ...params };
}

export async function deleteTag(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM t_customer_tag_relation WHERE tag_id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  await queryWithTenant("DELETE FROM t_customer_tag WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { id };
}

// ===== 客户标签关联 =====
export async function addCustomerTag(customerId: number, tagId: number, tenantId: string) {
  await queryWithTenant("INSERT IGNORE INTO t_customer_tag_relation (customer_id, tag_id, tenant_id) VALUES (?, ?, ?)", [customerId, tagId, tenantId], tenantId);
  return { customerId, tagId };
}

export async function removeCustomerTag(customerId: number, tagId: number, tenantId: string) {
  await queryWithTenant("DELETE FROM t_customer_tag_relation WHERE customer_id = ? AND tag_id = ? AND tenant_id = ?", [customerId, tagId, tenantId], tenantId);
  return { customerId, tagId };
}

export async function getCustomerTags(customerId: number, tenantId: string) {
  return queryWithTenant<CustomerTagRow>(
    `SELECT ct.id, ct.tag_name AS tagName, ct.tag_type AS tagType, ct.tag_group AS tagGroup
     FROM t_customer_tag_relation ctr
     JOIN t_customer_tag ct ON ct.id = ctr.tag_id AND ct.tenant_id = ctr.tenant_id
     WHERE ctr.customer_id = ? AND ctr.tenant_id = ?`,
    [customerId, tenantId], tenantId
  );
}

// ===== 客户画像 =====
export async function getCustomerProfile(customerId: number, tenantId: string) {
  let profile = await queryOneWithTenant<CustomerProfileRow>(
    "SELECT customer_id AS customerId, age_group AS ageGroup, gender, prefer_category AS preferCategory, prefer_brand AS preferBrand, avg_order_amount AS avgOrderAmount, total_order_count AS totalOrderCount, last_order_at AS lastOrderAt, total_points AS totalPoints, member_level AS memberLevel, lifecycle_stage AS lifecycleStage FROM t_customer_profile WHERE customer_id = ? AND tenant_id = ?",
    [customerId, tenantId], tenantId
  );
  if (!profile) {
    await queryWithTenant("INSERT INTO t_customer_profile (customer_id, lifecycle_stage, tenant_id) VALUES (?, 'PROSPECT', ?)", [customerId, tenantId], tenantId);
    profile = { customerId, ageGroup: null, gender: null, preferCategory: null, preferBrand: null, avgOrderAmount: 0, totalOrderCount: 0, lastOrderAt: null, totalPoints: 0, memberLevel: "VIP1", lifecycleStage: "PROSPECT" };
  }
  const tags = await getCustomerTags(customerId, tenantId);
  const member = await queryOneWithTenant<MemberNameMobileRow>("SELECT name, mobile FROM t_member WHERE id = ? AND tenant_id = ?", [customerId, tenantId], tenantId);
  const points = await queryOneWithTenant<CustomerPointsRow>("SELECT total_points AS totalPoints, available_points AS availablePoints FROM t_customer_points WHERE customer_id = ? AND tenant_id = ?", [customerId, tenantId], tenantId);
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
  const stats = await queryOneWithTenant<CustomerOrderStatsRow>(
    `SELECT COUNT(*) AS orderCount, COALESCE(AVG(receivable_amount), 0) AS avgAmount, MAX(created_at) AS lastOrder
     FROM t_sale_bill WHERE member_id = ? AND tenant_id = ? AND business_status = 'CREATED'`,
    [customerId, tenantId], tenantId
  );
  const points = await queryOneWithTenant<CustomerTotalPointsRow>("SELECT total_points AS totalPoints FROM t_customer_points WHERE customer_id = ? AND tenant_id = ?", [customerId, tenantId], tenantId);
  const level = await queryOneWithTenant<CustomerLevelRow>("SELECT level_name FROM t_customer_level WHERE customer_id = ? AND tenant_id = ?", [customerId, tenantId], tenantId);
  // 生命周期判定
  let stage = "PROSPECT";
  if (stats && Number(stats.orderCount) > 0) {
    const daysSinceLast = stats.lastOrder ? Math.floor((Date.now() - new Date(stats.lastOrder).getTime()) / 86400000) : 999;
    if (Number(stats.orderCount) === 1 && daysSinceLast <= 30) stage = "NEW";
    else if (daysSinceLast <= 30) stage = "ACTIVE";
    else if (daysSinceLast <= 90) stage = "DORMANT";
    else stage = "LOST";
  }
  await queryWithTenant(
    `INSERT INTO t_customer_profile (customer_id, total_order_count, avg_order_amount, last_order_at, total_points, member_level, lifecycle_stage, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE total_order_count=VALUES(total_order_count), avg_order_amount=VALUES(avg_order_amount), last_order_at=VALUES(last_order_at), total_points=VALUES(total_points), member_level=VALUES(member_level), lifecycle_stage=VALUES(lifecycle_stage)`,
    [customerId, stats?.orderCount ?? 0, stats?.avgAmount ?? 0, stats?.lastOrder ?? null, points?.totalPoints ?? 0, level?.level_name ?? "VIP1", stage, tenantId],
    tenantId
  );
  return { customerId, stage };
}