import { queryWithTenant, queryOneWithTenant, transaction, connExecute } from "../../shared/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { AppError } from "../../shared/app-error";
import { makeBizNo } from "../../shared/id";
import logger from "../../shared/logger";

// ==================== 类型定义 ====================

/** 计数 total 行 */
interface CountTotalRow {
  total: number;
}

/** 会员信息行 */
interface MemberProfileRow {
  id: number;
  name: string;
  nickname: string | null;
  avatar: string | null;
  mobile: string | null;
  gender: number | string;
  birthday: string | null;
  customerType: string;
  points: number | string;
  growthValue: number | string;
  levelCode: string | null;
  status: number | string;
  createdAt: string | Date;
}

/** 会员等级行（基础） */
interface MemberLevelRow {
  id: number;
  levelCode: string;
  levelName: string;
  levelIcon: string | null;
  minPoints: number | string;
  minGrowth: number | string;
  discountRate: number | string;
  pointRatio: number | string;
  description: string | null;
  sortNo: number;
}

/** 会员等级列表行（含赠品/包邮/状态） */
interface MemberLevelListRow {
  id: number;
  levelCode: string;
  levelName: string;
  levelIcon: string | null;
  minPoints: number | string;
  minGrowth: number | string;
  discountRate: number | string;
  birthdayGift: number | string;
  freeShippingAmount: number | string;
  pointRatio: number | string;
  description: string | null;
  sortNo: number;
  status: number | string;
}

/** 优惠券统计行 */
interface CouponStatsRow {
  availableCount: number | string;
  usedCount: number | string;
  expiredCount: number | string;
}

/** 积分明细行 */
interface PointsRecordRow {
  id: number;
  type: string;
  changePoints: number | string;
  balancePoints: number | string;
  sourceType: string | null;
  sourceId: number | string | null;
  remark: string | null;
  createdAt: string | Date;
}

/** 积分汇总行 */
interface PointsSummaryRow {
  totalEarn: number | string;
  totalSpend: number | string;
  totalExpire: number | string;
}

/** 会员积分行 */
interface MemberPointsRow {
  points: number | string;
}

/** 成长值明细行 */
interface GrowthRecordRow {
  id: number;
  type: string;
  changeGrowth: number | string;
  balanceGrowth: number | string;
  sourceType: string | null;
  sourceId: number | string | null;
  remark: string | null;
  createdAt: string | Date;
}

/** 成长值汇总行 */
interface GrowthSummaryRow {
  totalEarn: number | string;
  totalDeduct: number | string;
}

/** 会员成长值行 */
interface MemberGrowthRow {
  growthValue: number | string;
}

/** 用户优惠券行 */
interface UserCouponRow {
  id: number;
  couponNo: string;
  templateId: number;
  couponType: string;
  couponName: string;
  couponValue: number | string;
  minPurchase: number | string;
  maxDiscount: number | string | null;
  applicableScope: string;
  applicableIds: string | null;
  status: string;
  validStart: string | Date;
  validEnd: string | Date;
  usedAt: string | Date | null;
  usedOrderNo: string | null;
  discountAmount: number | string | null;
}

/** 优惠券模板行 — receiveCoupon 事务内 SELECT t_coupon_template */
interface CouponTemplateRow extends RowDataPacket {
  id: number;
  templateCode: string;
  templateName: string;
  couponType: string;
  couponValue: number | string;
  minPurchase: number | string;
  maxDiscount: number | string | null;
  applicableScope: string;
  applicableIds: string | null;
  totalQuantity: number;
  issuedQuantity: number;
  perLimit: number;
  validType: string;
  validStart: string | Date;
  validEnd: string | Date;
  validDays: number | null;
  status: string;
}

/** 优惠券领取数量行 — receiveCoupon 事务内 COUNT 查询 */
interface CouponCountRow extends RowDataPacket {
  count: number;
}

/** 会员更新后信息行 */
interface MemberUpdatedRow {
  id: number;
  name: string;
  nickname: string | null;
  avatar: string | null;
  mobile: string | null;
  gender: number | string;
  birthday: string | null;
  customerType: string;
  points: number | string;
  growthValue: number | string;
}

/** 会员密码行 */
interface MemberPasswordRow {
  id: number;
  passwordHash: string | null;
}

// ========== 获取会员信息 ==========
export async function getMemberProfile(memberId: number, tenantId: string) {
  const member = await queryOneWithTenant<MemberProfileRow>(
    `SELECT id, name, nickname, avatar, mobile, gender, birthday, 
            customer_type AS customerType, points, growth_value AS growthValue,
            level_code AS levelCode, status, created_at AS createdAt
     FROM t_member 
     WHERE id = ? AND tenant_id = ?`,
    [memberId, tenantId],
    tenantId
  );

  if (!member) {
    throw new AppError("会员不存在", 404);
  }

  // 获取当前等级信息
  const level = await queryOneWithTenant<MemberLevelRow>(
    `SELECT id, level_code AS levelCode, level_name AS levelName, level_icon AS levelIcon,
            min_points AS minPoints, min_growth AS minGrowth, discount_rate AS discountRate,
            point_ratio AS pointRatio, description, sort_no AS sortNo
     FROM t_member_level 
     WHERE status = 1 AND tenant_id = ?
     ORDER BY sort_no ASC, min_growth ASC
     LIMIT 1`,
    [],
    tenantId
  );

  // 计算当前等级（基于成长值）
  const allLevels = await queryWithTenant<MemberLevelRow>(
    `SELECT id, level_code AS levelCode, level_name AS levelName, level_icon AS levelIcon,
            min_points AS minPoints, min_growth AS minGrowth, discount_rate AS discountRate,
            point_ratio AS pointRatio, description, sort_no AS sortNo
     FROM t_member_level 
     WHERE status = 1 AND tenant_id = ?
     ORDER BY min_growth DESC`,
    [],
    tenantId
  );

  let currentLevel = allLevels[allLevels.length - 1] || null;
  let nextLevel: MemberLevelRow | null = null;

  for (let i = 0; i < allLevels.length; i++) {
    if (member.growthValue >= allLevels[i].minGrowth) {
      currentLevel = allLevels[i];
      nextLevel = i > 0 ? allLevels[i - 1] : null;
      break;
    }
  }

  // 计算升级进度
  let upgradeProgress = 0;
  if (currentLevel && nextLevel) {
    const currentMin = Number(currentLevel.minGrowth) || 0;
    const nextMin = Number(nextLevel.minGrowth) || 0;
    const range = nextMin - currentMin;
    if (range > 0) {
      upgradeProgress = Math.min(100, Math.round(((Number(member.growthValue) - currentMin) / range) * 100));
    } else {
      upgradeProgress = 100;
    }
  } else if (currentLevel && !nextLevel) {
    // 已是最高等级
    upgradeProgress = 100;
  }

  // 优惠券统计
  const couponStats = await queryOneWithTenant<CouponStatsRow>(
    `SELECT 
       SUM(CASE WHEN status = 'UNUSED' AND valid_end > NOW() THEN 1 ELSE 0 END) AS availableCount,
       SUM(CASE WHEN status = 'USED' THEN 1 ELSE 0 END) AS usedCount,
       SUM(CASE WHEN (status = 'UNUSED' AND valid_end <= NOW()) OR status = 'EXPIRED' THEN 1 ELSE 0 END) AS expiredCount
     FROM t_user_coupon 
     WHERE user_id = ? AND tenant_id = ?`,
    [memberId, tenantId],
    tenantId
  );

  return {
    memberId: member.id,
    name: member.name,
    nickname: member.nickname || member.name || "微信用户",
    avatar: member.avatar || "",
    mobile: member.mobile ? member.mobile.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2") : "",
    gender: member.gender || 0,
    birthday: member.birthday || "",
    customerType: member.customerType,
    points: member.points || 0,
    growthValue: member.growthValue || 0,
    level: currentLevel
      ? {
        levelCode: currentLevel.levelCode,
        levelName: currentLevel.levelName,
        levelIcon: currentLevel.levelIcon || "",
        discountRate: Number(currentLevel.discountRate),
        pointRatio: Number(currentLevel.pointRatio),
        description: currentLevel.description || ""
      }
      : null,
    nextLevel: nextLevel
      ? {
        levelCode: nextLevel.levelCode,
        levelName: nextLevel.levelName,
        minGrowth: nextLevel.minGrowth,
        levelIcon: nextLevel.levelIcon || ""
      }
      : null,
    upgradeProgress,
    couponStats: {
      availableCount: Number(couponStats?.availableCount || 0),
      usedCount: Number(couponStats?.usedCount || 0),
      expiredCount: Number(couponStats?.expiredCount || 0)
    },
    createdAt: member.createdAt
  };
}

// ========== 获取会员等级列表 ==========
export async function getMemberLevels(tenantId: string) {
  const rows = await queryWithTenant<MemberLevelListRow>(
    `SELECT id, level_code AS levelCode, level_name AS levelName, level_icon AS levelIcon,
            min_points AS minPoints, min_growth AS minGrowth, discount_rate AS discountRate,
            birthday_gift AS birthdayGift, free_shipping_amount AS freeShippingAmount,
            point_ratio AS pointRatio, description, sort_no AS sortNo, status
     FROM t_member_level 
     WHERE status = 1 AND tenant_id = ?
     ORDER BY sort_no ASC, min_growth ASC`,
    [],
    tenantId
  );

  return rows.map((row: MemberLevelListRow) => ({
    id: row.id,
    levelCode: row.levelCode,
    levelName: row.levelName,
    levelIcon: row.levelIcon || "",
    minPoints: row.minPoints,
    minGrowth: row.minGrowth,
    discountRate: Number(row.discountRate),
    birthdayGift: Number(row.birthdayGift || 0),
    freeShippingAmount: Number(row.freeShippingAmount || 0),
    pointRatio: Number(row.pointRatio),
    description: row.description || "",
    sortNo: row.sortNo
  }));
}

// ========== 获取积分明细 ==========
export async function getPointsRecords(
  memberId: number,
  tenantId: string,
  page: number,
  pageSize: number,
  type?: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["member_id = ?"];
  const params: unknown[] = [memberId];

  if (type && type !== "ALL") {
    conditions.push("type = ?");
    params.push(type);
  }

  const where = conditions.join(" AND ");

  const records = await queryWithTenant<PointsRecordRow>(
    `SELECT id, type, change_points AS changePoints, balance_points AS balancePoints,
            source_type AS sourceType, source_id AS sourceId, remark, created_at AS createdAt
     FROM t_points_record 
     WHERE ${where} AND tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, tenantId, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_points_record WHERE ${where} AND tenant_id = ?`,
    [...params, tenantId],
    tenantId
  );

  // 积分汇总
  const summary = await queryOneWithTenant<PointsSummaryRow>(
    `SELECT 
       COALESCE(SUM(CASE WHEN type = 'EARN' THEN change_points ELSE 0 END), 0) AS totalEarn,
       COALESCE(SUM(CASE WHEN type = 'SPEND' THEN ABS(change_points) ELSE 0 END), 0) AS totalSpend,
       COALESCE(SUM(CASE WHEN type = 'EXPIRE' THEN ABS(change_points) ELSE 0 END), 0) AS totalExpire
     FROM t_points_record 
     WHERE member_id = ? AND tenant_id = ?`,
    [memberId, tenantId],
    tenantId
  );

  const member = await queryOneWithTenant<MemberPointsRow>(
    "SELECT points FROM t_member WHERE id = ? AND tenant_id = ?",
    [memberId, tenantId],
    tenantId
  );

  return {
    total: Number(totalRow?.total || 0),
    page,
    pageSize,
    records: records.map((r: PointsRecordRow) => ({
      id: r.id,
      type: r.type,
      changePoints: r.changePoints,
      balancePoints: r.balancePoints,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      remark: r.remark,
      createdAt: r.createdAt
    })),
    summary: {
      availablePoints: member?.points || 0,
      totalEarn: Number(summary?.totalEarn || 0),
      totalSpend: Number(summary?.totalSpend || 0),
      totalExpire: Number(summary?.totalExpire || 0)
    }
  };
}

// ========== 获取成长值明细 ==========
export async function getGrowthRecords(
  memberId: number,
  tenantId: string,
  page: number,
  pageSize: number,
  type?: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["member_id = ?"];
  const params: unknown[] = [memberId];

  if (type && type !== "ALL") {
    conditions.push("type = ?");
    params.push(type);
  }

  const where = conditions.join(" AND ");

  const records = await queryWithTenant<GrowthRecordRow>(
    `SELECT id, type, change_growth AS changeGrowth, balance_growth AS balanceGrowth,
            source_type AS sourceType, source_id AS sourceId, remark, created_at AS createdAt
     FROM t_growth_record 
     WHERE ${where} AND tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, tenantId, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_growth_record WHERE ${where} AND tenant_id = ?`,
    [...params, tenantId],
    tenantId
  );

  // 成长值汇总
  const summary = await queryOneWithTenant<GrowthSummaryRow>(
    `SELECT 
       COALESCE(SUM(CASE WHEN type = 'EARN' THEN change_growth ELSE 0 END), 0) AS totalEarn,
       COALESCE(SUM(CASE WHEN type = 'DEDUCT' THEN ABS(change_growth) ELSE 0 END), 0) AS totalDeduct
     FROM t_growth_record 
     WHERE member_id = ? AND tenant_id = ?`,
    [memberId, tenantId],
    tenantId
  );

  const member = await queryOneWithTenant<MemberGrowthRow>(
    "SELECT growth_value AS growthValue FROM t_member WHERE id = ? AND tenant_id = ?",
    [memberId, tenantId],
    tenantId
  );

  return {
    total: Number(totalRow?.total || 0),
    page,
    pageSize,
    records: records.map((r: GrowthRecordRow) => ({
      id: r.id,
      type: r.type,
      changeGrowth: r.changeGrowth,
      balanceGrowth: r.balanceGrowth,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      remark: r.remark,
      createdAt: r.createdAt
    })),
    summary: {
      currentGrowth: member?.growthValue || 0,
      totalEarn: Number(summary?.totalEarn || 0),
      totalDeduct: Number(summary?.totalDeduct || 0)
    }
  };
}

// ========== 获取我的优惠券列表 ==========
export async function getMyCoupons(
  memberId: number,
  tenantId: string,
  page: number,
  pageSize: number,
  status?: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["user_id = ?"];
  const params: unknown[] = [memberId];

  if (status) {
    if (status === "AVAILABLE") {
      conditions.push("status = 'UNUSED' AND valid_end > NOW()");
    } else if (status === "USED") {
      conditions.push("status = 'USED'");
    } else if (status === "EXPIRED") {
      conditions.push("(status = 'EXPIRED' OR (status = 'UNUSED' AND valid_end <= NOW()))");
    }
  }

  const where = conditions.join(" AND ");

  const records = await queryWithTenant<UserCouponRow>(
    `SELECT uc.id, uc.coupon_no AS couponNo, uc.template_id AS templateId, 
            uc.coupon_type AS couponType, uc.coupon_name AS couponName,
            uc.coupon_value AS couponValue, uc.min_purchase AS minPurchase,
            uc.max_discount AS maxDiscount, uc.applicable_scope AS applicableScope,
            uc.applicable_ids AS applicableIds, uc.status,
            uc.valid_start AS validStart, uc.valid_end AS validEnd,
            uc.used_at AS usedAt, uc.used_order_no AS usedOrderNo,
            uc.discount_amount AS discountAmount
     FROM t_user_coupon uc
     WHERE ${where} AND uc.tenant_id = ?
     ORDER BY 
       CASE WHEN uc.status = 'UNUSED' AND uc.valid_end > NOW() THEN 1 ELSE 2 END,
       uc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, tenantId, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_user_coupon uc WHERE ${where} AND uc.tenant_id = ?`,
    [...params, tenantId],
    tenantId
  );

  return {
    total: Number(totalRow?.total || 0),
    page,
    pageSize,
    records: records.map((r: UserCouponRow) => {
      // 计算实际状态（考虑过期）
      let actualStatus = r.status;
      if (r.status === "UNUSED" && new Date(r.validEnd) < new Date()) {
        actualStatus = "EXPIRED";
      }
      return {
        id: r.id,
        couponNo: r.couponNo,
        templateId: r.templateId,
        couponType: r.couponType,
        couponName: r.couponName,
        couponValue: Number(r.couponValue),
        minPurchase: Number(r.minPurchase),
        maxDiscount: r.maxDiscount ? Number(r.maxDiscount) : null,
        applicableScope: r.applicableScope,
        applicableIds: r.applicableIds,
        status: actualStatus,
        validStart: r.validStart,
        validEnd: r.validEnd,
        usedAt: r.usedAt,
        usedOrderNo: r.usedOrderNo,
        discountAmount: r.discountAmount ? Number(r.discountAmount) : null
      };
    })
  };
}

// ========== 领取优惠券 ==========
export async function receiveCoupon(memberId: number, templateId: number, tenantId: string) {
  return await transaction(async (conn) => {
    // 查询优惠券模板
    const [templateRows] = await connExecute<CouponTemplateRow[]>(
      conn,
      `SELECT id, template_code AS templateCode, template_name AS templateName,
              coupon_type AS couponType, coupon_value AS couponValue,
              min_purchase AS minPurchase, max_discount AS maxDiscount,
              applicable_scope AS applicableScope, applicable_ids AS applicableIds,
              total_quantity AS totalQuantity, issued_quantity AS issuedQuantity,
              per_limit AS perLimit, valid_type AS validType,
              valid_start AS validStart, valid_end AS validEnd,
              valid_days AS validDays, status
       FROM t_coupon_template
       WHERE id = ? AND tenant_id = ?
       LIMIT 1`,
      [templateId, tenantId]
    );
    const template = templateRows[0];

    if (!template) {
      throw new AppError("优惠券不存在", 404);
    }

    if (template.status !== "ACTIVE") {
      throw new AppError("优惠券不可领取", 400);
    }

    // 检查是否已达发行上限
    if (template.totalQuantity > 0 && template.issuedQuantity >= template.totalQuantity) {
      throw new AppError("优惠券已领完", 400);
    }

    // 检查每人限领数量
    const [countRows] = await connExecute<CouponCountRow[]>(
      conn,
      "SELECT COUNT(*) AS count FROM t_user_coupon WHERE user_id = ? AND template_id = ? AND tenant_id = ?",
      [memberId, templateId, tenantId]
    );
    const receivedCount = countRows[0];

    if (template.perLimit > 0 && Number(receivedCount?.count || 0) >= template.perLimit) {
      throw new AppError(`每人限领${template.perLimit}张`, 400);
    }

    // 计算有效期
    let validStart = template.validStart;
    let validEnd = template.validEnd;

    if (template.validType === "DAYS" && template.validDays) {
      const now = new Date();
      validStart = now;
      validEnd = new Date(now.getTime() + template.validDays * 24 * 60 * 60 * 1000);
    }

    // 生成优惠券编号
    const couponNo = makeBizNo("CP");

    // 创建用户优惠券
    await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_user_coupon
       (coupon_no, template_id, user_id, coupon_type, coupon_name, coupon_value,
        min_purchase, max_discount, applicable_scope, applicable_ids,
        source, status, valid_start, valid_end, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVE', 'UNUSED', ?, ?, ?)`,
      [
        couponNo,
        templateId,
        memberId,
        template.couponType,
        template.templateName,
        template.couponValue,
        template.minPurchase,
        template.maxDiscount,
        template.applicableScope,
        template.applicableIds,
        validStart,
        validEnd,
        tenantId
      ]
    );

    // 更新发行数量
    await connExecute<ResultSetHeader>(
      conn,
      "UPDATE t_coupon_template SET issued_quantity = issued_quantity + 1 WHERE id = ? AND tenant_id = ?",
      [templateId, tenantId]
    );

    logger.info(`[优惠券领取] 成功 memberId=${memberId} templateId=${templateId} couponNo=${couponNo}`);

    return {
      couponNo,
      templateId,
      couponName: template.templateName,
      couponType: template.couponType,
      couponValue: Number(template.couponValue),
      minPurchase: Number(template.minPurchase),
      validStart,
      validEnd
    };
  });
}

// ========== 更新用户信息 ==========
export async function updateUserProfile(
  memberId: number,
  tenantId: string,
  data: {
    nickname?: string;
    avatar?: string;
    gender?: number;
    birthday?: string;
  }
) {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.nickname !== undefined) {
    updates.push("nickname = ?");
    params.push(data.nickname);
  }
  if (data.avatar !== undefined) {
    updates.push("avatar = ?");
    params.push(data.avatar);
  }
  if (data.gender !== undefined) {
    updates.push("gender = ?");
    params.push(data.gender);
  }
  if (data.birthday !== undefined) {
    updates.push("birthday = ?");
    params.push(data.birthday);
  }

  if (updates.length === 0) {
    throw new AppError("没有需要更新的字段", 400);
  }

  params.push(memberId, tenantId);

  await queryWithTenant(
    `UPDATE t_member SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`,
    params,
    tenantId
  );

  // 返回更新后的信息
  const member = await queryOneWithTenant<MemberUpdatedRow>(
    `SELECT id, name, nickname, avatar, mobile, gender, birthday,
            customer_type AS customerType, points, growth_value AS growthValue
     FROM t_member WHERE id = ? AND tenant_id = ?`,
    [memberId, tenantId],
    tenantId
  );

  if (!member) {
    throw new Error("会员不存在");
  }

  return {
    memberId: member.id,
    nickname: member.nickname,
    avatar: member.avatar,
    gender: member.gender,
    birthday: member.birthday
  };
}

// ========== 修改密码 ==========
export async function changePassword(
  memberId: number,
  tenantId: string,
  oldPassword: string,
  newPassword: string
) {
  const { verifyPassword, hashPassword, validatePassword } = await import("../../shared/password");

  // 验证新密码强度
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    throw new AppError(`新密码不符合要求：${validation.errors.join("；")}`, 400);
  }

  // 查询原密码
  const member = await queryOneWithTenant<MemberPasswordRow>(
    "SELECT id, password_hash AS passwordHash FROM t_member WHERE id = ? AND tenant_id = ?",
    [memberId, tenantId],
    tenantId
  );

  if (!member) {
    throw new AppError("用户不存在", 404);
  }

  if (!member.passwordHash) {
    throw new AppError("请先设置密码", 400);
  }

  // 验证原密码
  const isValid = await verifyPassword(oldPassword, member.passwordHash);
  if (!isValid) {
    throw new AppError("原密码错误", 400);
  }

  // 新密码不能与原密码相同
  const samePassword = await verifyPassword(newPassword, member.passwordHash);
  if (samePassword) {
    throw new AppError("新密码不能与原密码相同", 400);
  }

  // 生成新密码哈希
  const newHash = await hashPassword(newPassword);

  // 更新密码
  await queryWithTenant(
    "UPDATE t_member SET password_hash = ? WHERE id = ? AND tenant_id = ?",
    [newHash, memberId, tenantId],
    tenantId
  );

  logger.info(`[修改密码] 成功 memberId=${memberId}`);

  return { message: "密码修改成功" };
}
