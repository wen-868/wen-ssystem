import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { hashPassword, validatePassword } from "../../shared/password";
import { AppError } from "../../shared/app-error";
import logger from "../../shared/logger";
import { sendSmsCode, isSmsVerifyEnabled, verifySmsCode } from "../sms.service";
import type { ResultSetHeader } from "mysql2/promise";

/** SELECT id 通用返回 */
interface IdRow {
  id: number | string;
}

/** t_member 会员卡基础信息行（带别名） */
interface MemberCardMemberRow {
  id: number | string;
  name: string;
  mobile: string;
  memberLevel: string | null;
  createdAt: string | Date;
}

/** t_customer_points 积分行（带别名） */
interface CustomerPointsRow {
  totalPoints: number | string;
  availablePoints: number | string;
}

/** t_customer_level 等级行（带别名） */
interface CustomerLevelRow {
  levelName: string;
  levelPoints: number | string;
  upgradedAt: string | Date | null;
}

/** t_store_value_card 储值卡行（带别名） */
interface StoreValueCardRow {
  cardNo: string;
  balance: number | string;
  status: string;
}

/** t_level_config 折扣配置行（带别名，按 level_name 查询） */
interface LevelConfigDiscountRow {
  discountRate: number | string;
  benefits: string | null;
}

/** t_level_config 等级配置列表行（带别名） */
interface LevelConfigListRow {
  levelName: string;
  discountRate: number | string;
  benefits: string | null;
}

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

  const existing = await queryOneWithTenant<IdRow>(
    "SELECT id FROM t_member WHERE mobile = ? AND tenant_id = ?",
    [mobile, tenantId], tenantId
  );
  if (existing) {
    throw new AppError("该手机号已注册", 400);
  }

  // 总台短信验证开关开启时校验验证码，关闭时无需验证码
  if (await isSmsVerifyEnabled(tenantId)) {
    if (!smsCode) {
      throw new AppError("请输入短信验证码", 400);
    }
    await verifySmsCode(mobile, smsCode, "REGISTER", tenantId);
  }

  const passwordHash = await hashPassword(password);

  const result = await queryWithTenant<ResultSetHeader>(
    "INSERT INTO t_member (name, mobile, password_hash, register_source, tenant_id) VALUES (?, ?, ?, 'SELF_REGISTER', ?)",
    [name || "", mobile, passwordHash, tenantId], tenantId
  );
  const memberId = (result as unknown as Record<string, unknown>).insertId;

  await queryWithTenant(
    "INSERT INTO t_customer_points (customer_id, total_points, available_points, tenant_id) VALUES (?, 0, 0, ?)",
    [memberId, tenantId], tenantId
  );
  await queryWithTenant(
    "INSERT INTO t_customer_level (customer_id, level_name, level_points, tenant_id) VALUES (?, 'VIP1', 0, ?)",
    [memberId, tenantId], tenantId
  );
  await queryWithTenant(
    "INSERT INTO t_customer_profile (customer_id, lifecycle_stage, tenant_id) VALUES (?, 'PROSPECT', ?)",
    [memberId, tenantId], tenantId
  );

  logger.info(`[会员自助注册] 注册成功 memberId=${memberId} mobile=${mobile}`);

  return { id: memberId, name: name || "", mobile };
}

export async function sendRegisterSmsCode(mobile: string, tenantId: string): Promise<{ success: boolean; message: string }> {
  // 防御校验：格式不合法 / 手机号已注册直接拒绝（不发短信）
  if (!/^1[3-9]\d{9}$/.test(mobile)) {
    throw new AppError("手机号格式不正确", 400);
  }
  const existing = await queryOneWithTenant<IdRow>(
    "SELECT id FROM t_member WHERE mobile = ? AND tenant_id = ?",
    [mobile, tenantId], tenantId
  );
  if (existing) {
    throw new AppError("该手机号已注册", 400);
  }
  // 总台短信验证开关关闭时无需发送验证码
  if (!(await isSmsVerifyEnabled(tenantId))) {
    return { success: true, message: "短信验证未开启，注册无需验证码" };
  }
  // 真实短信发送（配置/发送失败直接抛错，不再返回开发环境验证码）
  return sendSmsCode(mobile, "REGISTER", tenantId);
}

// 注册会员（管理员操作）
export async function registerMember(params: { name: string; mobile: string; password?: string; referrerId?: number; tenantId: string }) {
  const { name, mobile, password, referrerId, tenantId } = params;
  const existing = await queryOneWithTenant<IdRow>("SELECT id FROM t_member WHERE mobile = ? AND tenant_id = ?", [mobile, tenantId], tenantId);
  if (existing) throw new Error("该手机号已注册");
  const result = await queryWithTenant<ResultSetHeader>(
    "INSERT INTO t_member (name, mobile, password_hash, referrer_id, level_code, tenant_id) VALUES (?, ?, ?, ?, 'VIP1', ?)",
    [name, mobile, password ?? null, referrerId ?? null, tenantId], tenantId
  );
  const memberId = (result as unknown as Record<string, unknown>).insertId;
  // 初始化积分账户
  await queryWithTenant("INSERT INTO t_customer_points (customer_id, total_points, available_points, tenant_id) VALUES (?, 0, 0, ?)", [memberId, tenantId], tenantId);
  // 初始化等级
  await queryWithTenant("INSERT INTO t_customer_level (customer_id, level_name, level_points, tenant_id) VALUES (?, 'VIP1', 0, ?)", [memberId, tenantId], tenantId);
  // 初始化画像
  await queryWithTenant("INSERT INTO t_customer_profile (customer_id, lifecycle_stage, tenant_id) VALUES (?, 'PROSPECT', ?)", [memberId, tenantId], tenantId);
  return { id: memberId, name, mobile };
}

// 会员卡信息
export async function getMemberCard(memberId: number, tenantId: string) {
  const member = await queryOneWithTenant<MemberCardMemberRow>(
    "SELECT id, name, mobile, member_level AS memberLevel, created_at AS createdAt FROM t_member WHERE id = ? AND tenant_id = ?",
    [memberId, tenantId], tenantId
  );
  if (!member) throw new Error("会员不存在");
  const points = await queryOneWithTenant<CustomerPointsRow>("SELECT total_points AS totalPoints, available_points AS availablePoints FROM t_customer_points WHERE customer_id = ? AND tenant_id = ?", [memberId, tenantId], tenantId);
  const level = await queryOneWithTenant<CustomerLevelRow>("SELECT level_name AS levelName, level_points AS levelPoints, upgraded_at AS upgradedAt FROM t_customer_level WHERE customer_id = ? AND tenant_id = ?", [memberId, tenantId], tenantId);
  const card = await queryOneWithTenant<StoreValueCardRow>("SELECT card_no AS cardNo, balance, status FROM t_store_value_card WHERE customer_id = ? AND tenant_id = ?", [memberId, tenantId], tenantId);
  const levelConfig = await queryOneWithTenant<LevelConfigDiscountRow>(
    "SELECT discount_rate AS discountRate, benefits FROM t_level_config WHERE level_name = ? AND tenant_id = ?",
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
  const member = await queryOneWithTenant<IdRow>("SELECT id FROM t_member WHERE id = ? AND tenant_id = ?", [memberId, tenantId], tenantId);
  if (!member) throw new Error("会员不存在");
  await queryWithTenant("UPDATE t_member SET member_level = ? WHERE id = ? AND tenant_id = ?", [levelName, memberId, tenantId], tenantId);
  await queryWithTenant("UPDATE t_customer_level SET level_name = ?, upgraded_at = NOW() WHERE customer_id = ? AND tenant_id = ?", [levelName, memberId, tenantId], tenantId);
  await queryWithTenant("UPDATE t_customer_profile SET member_level = ? WHERE customer_id = ? AND tenant_id = ?", [levelName, memberId, tenantId], tenantId);
  return { memberId, levelName };
}

// 会员权益
export async function getMemberBenefits(tenantId: string) {
  return queryWithTenant<LevelConfigListRow>(
    "SELECT level_name AS levelName, discount_rate AS discountRate, benefits FROM t_level_config WHERE tenant_id = ? ORDER BY min_points",
    [tenantId], tenantId
  );
}
