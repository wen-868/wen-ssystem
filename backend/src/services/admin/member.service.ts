import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

// 注册会员
export async function registerMember(params: { name: string; mobile: string; password?: string; referrerId?: number; tenantId: string }) {
  const { name, mobile, password, referrerId, tenantId } = params;
  const existing = await queryOneWithTenant<any>("SELECT id FROM member WHERE mobile = ? AND tenant_id = ?", [mobile, tenantId], tenantId);
  if (existing) throw new Error("该手机号已注册");
  const result = await queryWithTenant<any>(
    "INSERT INTO member (name, mobile, password, referrer_id, member_level, tenant_id) VALUES (?, ?, ?, ?, 'VIP1', ?)",
    [name, mobile, password ?? null, referrerId ?? null, tenantId], tenantId
  );
  const memberId = (result as unknown as Record<string, unknown>).insertId;
  // 初始化积分账户
  await queryWithTenant("INSERT INTO customer_points (customer_id, total_points, available_points, tenant_id) VALUES (?, 0, 0, ?)", [memberId, tenantId], tenantId);
  // 初始化等级
  await queryWithTenant("INSERT INTO customer_level (customer_id, level_name, level_points, tenant_id) VALUES (?, 'VIP1', 0, ?)", [memberId, tenantId], tenantId);
  // 初始化画像
  await queryWithTenant("INSERT INTO customer_profile (customer_id, lifecycle_stage, tenant_id) VALUES (?, 'PROSPECT', ?)", [memberId, tenantId], tenantId);
  return { id: memberId, name, mobile };
}

// 会员卡信息
export async function getMemberCard(memberId: number, tenantId: string) {
  const member = await queryOneWithTenant<any>(
    "SELECT id, name, mobile, member_level AS memberLevel, created_at AS createdAt FROM member WHERE id = ? AND tenant_id = ?",
    [memberId, tenantId], tenantId
  );
  if (!member) throw new Error("会员不存在");
  const points = await queryOneWithTenant<any>("SELECT total_points AS totalPoints, available_points AS availablePoints FROM customer_points WHERE customer_id = ? AND tenant_id = ?", [memberId, tenantId], tenantId);
  const level = await queryOneWithTenant<any>("SELECT level_name AS levelName, level_points AS levelPoints, upgraded_at AS upgradedAt FROM customer_level WHERE customer_id = ? AND tenant_id = ?", [memberId, tenantId], tenantId);
  const card = await queryOneWithTenant<any>("SELECT card_no AS cardNo, balance, status FROM store_value_card WHERE customer_id = ? AND tenant_id = ?", [memberId, tenantId], tenantId);
  const levelConfig = await queryOneWithTenant<any>(
    "SELECT discount_rate AS discountRate, benefits FROM level_config WHERE level_name = ? AND tenant_id = ?",
    [member.memberLevel ?? "VIP1", tenantId], tenantId
  );
  return {
    ...member,
    totalPoints: points?.totalPoints ?? 0,
    availablePoints: points?.availablePoints ?? 0,
    currentLevel: level?.levelName ?? "VIP1",
    levelPoints: level?.levelPoints ?? 0,
    upgradedAt: level?.upgradedAt ?? null,
    storeValueCard: card ?? null,
    discountRate: levelConfig?.discountRate ?? 1,
    benefits: levelConfig?.benefits ?? null
  };
}

// 手动调整等级
export async function updateMemberLevel(memberId: number, levelName: string, tenantId: string) {
  const member = await queryOneWithTenant<any>("SELECT id FROM member WHERE id = ? AND tenant_id = ?", [memberId, tenantId], tenantId);
  if (!member) throw new Error("会员不存在");
  await queryWithTenant("UPDATE member SET member_level = ? WHERE id = ? AND tenant_id = ?", [levelName, memberId, tenantId], tenantId);
  await queryWithTenant("UPDATE customer_level SET level_name = ?, upgraded_at = NOW() WHERE customer_id = ? AND tenant_id = ?", [levelName, memberId, tenantId], tenantId);
  await queryWithTenant("UPDATE customer_profile SET member_level = ? WHERE customer_id = ? AND tenant_id = ?", [levelName, memberId, tenantId], tenantId);
  return { memberId, levelName };
}

// 会员权益
export async function getMemberBenefits(tenantId: string) {
  return queryWithTenant<any>(
    "SELECT level_name AS levelName, discount_rate AS discountRate, benefits FROM level_config WHERE tenant_id = ? ORDER BY min_points",
    [tenantId], tenantId
  );
}