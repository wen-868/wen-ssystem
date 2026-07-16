import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { hashPassword, validatePassword } from "../../shared/password";
import { AppError } from "../../shared/app-error";
import logger from "../../shared/logger";

export async function selfRegisterMember(params: {
  mobile: string;
  password: string;
  smsCode: string;
  name?: string;
  tenantId: string;
}) {
  const { mobile, password, smsCode, name, tenantId } = params;

  const validation = validatePassword(password);
  if (!validation.valid) {
    throw new AppError(`密码不符合要求：${validation.errors.join("；")}`, 400);
  }

  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM t_member WHERE mobile = ? AND tenant_id = ?",
    [mobile, tenantId], tenantId
  );
  if (existing) {
    throw new AppError("该手机号已注册", 400);
  }

  const codeRecord = await queryOneWithTenant<any>(
    "SELECT id, used, expires_at FROM t_member_sms_code WHERE mobile = ? AND code = ? AND purpose = 'REGISTER' ORDER BY created_at DESC LIMIT 1",
    [mobile, smsCode], tenantId
  );

  if (!codeRecord) {
    throw new AppError("验证码错误", 400);
  }

  if (codeRecord.used) {
    throw new AppError("验证码已使用", 400);
  }

  if (new Date(codeRecord.expires_at) < new Date()) {
    throw new AppError("验证码已过期", 400);
  }

  const passwordHash = await hashPassword(password);

  const result = await queryWithTenant<any>(
    "INSERT INTO t_member (name, mobile, password_hash, register_source, tenant_id) VALUES (?, ?, ?, 'SELF_REGISTER', ?)",
    [name || "", mobile, passwordHash, tenantId], tenantId
  );
  const memberId = (result as unknown as Record<string, unknown>).insertId;

  await queryWithTenant("UPDATE t_member_sms_code SET used = 1 WHERE id = ?", [codeRecord.id], tenantId);

  await queryWithTenant(
    "INSERT INTO customer_points (customer_id, total_points, available_points, tenant_id) VALUES (?, 0, 0, ?)",
    [memberId, tenantId], tenantId
  );
  await queryWithTenant(
    "INSERT INTO customer_level (customer_id, level_name, level_points, tenant_id) VALUES (?, 'VIP1', 0, ?)",
    [memberId, tenantId], tenantId
  );
  await queryWithTenant(
    "INSERT INTO customer_profile (customer_id, lifecycle_stage, tenant_id) VALUES (?, 'PROSPECT', ?)",
    [memberId, tenantId], tenantId
  );

  logger.info(`[会员自助注册] 注册成功 memberId=${memberId} mobile=${mobile}`);

  return { id: memberId, name: name || "", mobile };
}

export async function sendRegisterSmsCode(mobile: string, tenantId: string): Promise<{ success: boolean; message: string }> {
  if (!/^1[3-9]\d{9}$/.test(mobile)) {
    throw new AppError("手机号格式不正确", 400);
  }

  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM t_member WHERE mobile = ? AND tenant_id = ?",
    [mobile, tenantId], tenantId
  );
  if (existing) {
    throw new AppError("该手机号已注册", 400);
  }

  const recentCode = await queryOneWithTenant<any>(
    "SELECT created_at FROM t_member_sms_code WHERE mobile = ? AND purpose = 'REGISTER' ORDER BY created_at DESC LIMIT 1",
    [mobile], tenantId
  );

  if (recentCode) {
    const createdTime = new Date(recentCode.created_at).getTime();
    const now = Date.now();
    if (now - createdTime < 60000) {
      throw new AppError("验证码发送过于频繁，请稍后再试", 400);
    }
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await queryWithTenant(
    "INSERT INTO t_member_sms_code (mobile, code, purpose, expires_at) VALUES (?, ?, 'REGISTER', ?)",
    [mobile, code, expiresAt], tenantId
  );

  logger.info(`[短信验证码] 发送成功 mobile=${mobile} code=${code}`);

  return { success: true, message: "验证码已发送（开发环境：" + code + "）" };
}

// 注册会员（管理员操作）
export async function registerMember(params: { name: string; mobile: string; password?: string; referrerId?: number; tenantId: string }) {
  const { name, mobile, password, referrerId, tenantId } = params;
  const existing = await queryOneWithTenant<any>("SELECT id FROM t_member WHERE mobile = ? AND tenant_id = ?", [mobile, tenantId], tenantId);
  if (existing) throw new Error("该手机号已注册");
  const result = await queryWithTenant<any>(
    "INSERT INTO t_member (name, mobile, password_hash, referrer_id, level_code, tenant_id) VALUES (?, ?, ?, ?, 'VIP1', ?)",
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
    "SELECT id, name, mobile, member_level AS memberLevel, created_at AS createdAt FROM t_member WHERE id = ? AND tenant_id = ?",
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
  const member = await queryOneWithTenant<any>("SELECT id FROM t_member WHERE id = ? AND tenant_id = ?", [memberId, tenantId], tenantId);
  if (!member) throw new Error("会员不存在");
  await queryWithTenant("UPDATE t_member SET member_level = ? WHERE id = ? AND tenant_id = ?", [levelName, memberId, tenantId], tenantId);
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