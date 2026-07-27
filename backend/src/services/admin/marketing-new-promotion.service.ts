import mysql from "mysql2/promise";
import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

interface PromotionRecord {
  id: number;
  activityCode: string;
  activityName: string;
  activityType: string;
  activityDesc: string;
  startTime: string;
  endTime: string;
  applicableScope: string;
  applicableIds: string;
  rules: string;
  maxParticipants: number;
  participantCount: number;
  status: string;
  priority: number;
  stackable: number;
  createdAt: string;
  updatedAt: string;
}

interface CreatePromotionBody {
  activityName: string;
  activityType: string;
  activityDesc?: string;
  startTime: string;
  endTime: string;
  applicableScope: string;
  applicableIds?: unknown;
  rules: unknown;
  maxParticipants: number;
  priority: number;
  stackable: number;
}

interface UpdatePromotionBody {
  activityName?: string;
  activityDesc?: string;
  startTime?: string;
  endTime?: string;
  applicableScope?: string;
  applicableIds?: unknown;
  rules?: unknown;
  maxParticipants?: number;
  priority?: number;
  stackable?: number;
  status?: string;
}

interface CalculateDiscountBody {
  userId: number;
  orderAmount: number;
  productIds: number[];
  couponNo?: string;
}

interface UserCoupon {
  id: number;
  couponType: string;
  couponValue: number;
  minPurchase: number;
  maxDiscount: number | null;
  applicableScope: string;
  applicableIds: string;
  validStart: string;
  validEnd: string;
}

interface PromotionActivity {
  id: number;
  activityType: string;
  rules: string;
  applicableScope: string;
  applicableIds: string;
  priority: number;
  stackable: number;
}

/** t_user_coupon 优惠券查询行（带别名） */
interface UserCouponQueryRow {
  id: number | string;
  couponType: string;
  couponValue: number | string;
  minPurchase: number | string;
  maxDiscount: number | string | null;
  applicableScope: string;
  applicableIds: string;
  validStart: string | Date;
  validEnd: string | Date;
}

function safeJsonParse<T = unknown>(str: string | null | undefined, defaultValue: T): T {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
}

async function logOperation(
  conn: mysql.PoolConnection,
  module: string,
  action: string,
  targetId: string,
  targetType: string,
  userId: number,
  username: string,
  detail: string,
  tenantId: string
) {
  await conn.execute(
    `INSERT INTO t_marketing_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [module, action, targetId, targetType, userId, username, detail, tenantId]
  );
}

export async function listPromotions(
  page: number,
  pageSize: number,
  tenantId: string,
  type?: string,
  status?: string
) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (type) {
    conditions.push("activity_type = ?");
    params.push(type);
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<PromotionRecord>(
    `SELECT id, activity_code AS activityCode, activity_name AS activityName,
            activity_type AS activityType, activity_desc AS activityDesc,
            start_time AS startTime, end_time AS endTime,
            applicable_scope AS applicableScope, applicable_ids AS applicableIds,
            rules, max_participants AS maxParticipants,
            participant_count AS participantCount, status, priority, stackable,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_promotion_activity
     ${where}
     ORDER BY start_time DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
    tenantId
  );

  const totalRow = await queryOneWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_promotion_activity ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function createPromotion(
  body: CreatePromotionBody,
  tenantId: string,
  userId: number,
  username: string
) {
  const activityCode = makeBizNo("PROMO");

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO t_promotion_activity (
        activity_code, activity_name, activity_type, activity_desc,
        start_time, end_time, applicable_scope, applicable_ids,
        rules, max_participants, priority, stackable,
        status, tenant_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`,
      [
        activityCode, body.activityName, body.activityType, body.activityDesc || null,
        body.startTime, body.endTime, body.applicableScope,
        body.applicableIds ? JSON.stringify(body.applicableIds) : null,
        JSON.stringify(body.rules), body.maxParticipants, body.priority, body.stackable,
        tenantId, userId
      ]
    );

    await logOperation(
      conn,
      "promotion",
      "CREATE",
      activityCode,
      "promotion_activity",
      userId,
      username,
      `创建促销活动: ${activityCode}, 名称: ${body.activityName}`,
      tenantId
    );
  });

  return { activityCode };
}

export async function updatePromotion(
  activityId: number,
  body: UpdatePromotionBody,
  tenantId: string,
  userId: number,
  username: string
) {
  const existing = await queryOneWithTenant<{ id: number; status: string }>(
    "SELECT id, status FROM t_promotion_activity WHERE id = ?",
    [activityId],
    tenantId
  );

  if (!existing) {
    throw Object.assign(new Error("促销活动不存在"), { statusCode: 404 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  const fieldMap: Record<string, string> = {
    activityName: "activity_name",
    activityDesc: "activity_desc",
    startTime: "start_time",
    endTime: "end_time",
    applicableScope: "applicable_scope",
    maxParticipants: "max_participants",
    priority: "priority",
    stackable: "stackable",
    status: "status",
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    const value = (body as Record<string, unknown>)[key];
    if (value !== undefined) {
      updates.push(`${column} = ?`);
      params.push(value);
    }
  }

  if (body.applicableIds !== undefined) {
    updates.push("applicable_ids = ?");
    params.push(JSON.stringify(body.applicableIds));
  }

  if (body.rules !== undefined) {
    updates.push("rules = ?");
    params.push(JSON.stringify(body.rules));
  }

  if (updates.length > 0) {
    params.push(activityId);
    await queryWithTenant(
      `UPDATE t_promotion_activity SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params,
      tenantId
    );

    await queryWithTenant(
      `INSERT INTO t_marketing_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["promotion", "UPDATE", String(activityId), "promotion_activity", userId, username,
        `更新促销活动: ${activityId}`, tenantId],
      tenantId
    );
  }

  return { activityId };
}

export async function calculateDiscount(
  body: CalculateDiscountBody,
  tenantId: string
) {
  let userCoupon: UserCoupon | null = null;
  if (body.couponNo) {
    const couponRecord = await queryOneWithTenant<UserCouponQueryRow>(
      `SELECT id, coupon_type AS couponType, coupon_value AS couponValue, min_purchase AS minPurchase, max_discount AS maxDiscount,
              applicable_scope AS applicableScope, applicable_ids AS applicableIds, valid_start AS validStart, valid_end AS validEnd
       FROM t_user_coupon
       WHERE coupon_no = ? AND user_id = ? AND status = 'UNUSED'`,
      [body.couponNo, body.userId],
      tenantId
    );

    if (!couponRecord) {
      throw Object.assign(new Error("优惠券不存在或已使用"), { statusCode: 400 });
    }

    userCoupon = couponRecord as UserCoupon;

    const now = new Date();
    if (now < new Date(userCoupon.validStart) || now > new Date(userCoupon.validEnd)) {
      throw Object.assign(new Error("优惠券已过期"), { statusCode: 400 });
    }

    if (body.orderAmount < userCoupon.minPurchase) {
      throw Object.assign(new Error(`订单金额需满${userCoupon.minPurchase}元`), { statusCode: 400 });
    }
  }

  const promotions = await queryWithTenant<PromotionActivity>(
    `SELECT id, activity_type AS activityType, rules, applicable_scope AS applicableScope, applicable_ids AS applicableIds, priority, stackable
     FROM t_promotion_activity
     WHERE status = 'ACTIVE'
       AND start_time <= NOW() AND end_time >= NOW()
     ORDER BY priority DESC`,
    [],
    tenantId
  );

  let promotionDiscount = 0;
  let appliedPromotions: { activityId: number; type: string; discount: number }[] = [];

  for (const promo of promotions) {
    if (promo.applicableScope !== "ALL") {
      const applicableIds = safeJsonParse<number[]>(promo.applicableIds, []);
      const hasMatch = body.productIds.some(id => applicableIds.includes(id));
      if (!hasMatch) continue;
    }

    const rules = safeJsonParse<{ threshold_amount: number; reduction_amount: number; is_continuous?: boolean }[]>(promo.rules, []);

    if (promo.activityType === "FULL_REDUCTION") {
      for (const rule of rules) {
        if (body.orderAmount >= rule.threshold_amount) {
          let discount = rule.reduction_amount;
          if (rule.is_continuous) {
            discount = Math.floor(body.orderAmount / rule.threshold_amount) * rule.reduction_amount;
          }
          if (discount > promotionDiscount) {
            promotionDiscount = discount;
            appliedPromotions = [{ activityId: promo.id, type: "FULL_REDUCTION", discount }];
          }
          break;
        }
      }
    }

    if (!promo.stackable && appliedPromotions.length > 0) {
      break;
    }
  }

  let couponDiscount = 0;
  if (userCoupon) {
    if (userCoupon.couponType === "AMOUNT") {
      couponDiscount = userCoupon.couponValue;
    } else if (userCoupon.couponType === "DISCOUNT") {
      couponDiscount = body.orderAmount * (1 - userCoupon.couponValue);
      if (userCoupon.maxDiscount && couponDiscount > userCoupon.maxDiscount) {
        couponDiscount = userCoupon.maxDiscount;
      }
    }
  }

  const totalDiscount = promotionDiscount + couponDiscount;
  const finalAmount = Math.max(0, body.orderAmount - totalDiscount);

  return {
    originalAmount: body.orderAmount,
    promotionDiscount,
    couponDiscount,
    totalDiscount,
    finalAmount,
    appliedPromotions,
    usedCoupon: userCoupon ? { couponNo: body.couponNo, discount: couponDiscount } : null
  };
}