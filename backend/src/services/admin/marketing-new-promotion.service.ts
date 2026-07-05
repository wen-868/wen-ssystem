import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

export async function listPromotions(
  page: number,
  pageSize: number,
  tenantId: string,
  type?: string,
  status?: string
) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (type) {
    conditions.push("activity_type = ?");
    params.push(type);
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<any>(
    `SELECT id, activity_code AS activityCode, activity_name AS activityName,
            activity_type AS activityType, activity_desc AS activityDesc,
            start_time AS startTime, end_time AS endTime,
            applicable_scope AS applicableScope, applicable_ids AS applicableIds,
            rules, max_participants AS maxParticipants,
            participant_count AS participantCount, status, priority, stackable,
            created_at AS createdAt, updated_at AS updatedAt
     FROM promotion_activity
     ${where}
     ORDER BY start_time DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM promotion_activity ${where}`,
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

export async function createPromotion(body: {
  activityName: string;
  activityType: string;
  activityDesc?: string;
  startTime: string;
  endTime: string;
  applicableScope: string;
  applicableIds?: any;
  rules: any;
  maxParticipants: number;
  priority: number;
  stackable: number;
}, tenantId: string, userId: number, username: string) {
  const activityCode = makeBizNo("PROMO");

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO promotion_activity (
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

    await conn.execute(
      `INSERT INTO marketing_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["promotion", "CREATE", activityCode, "promotion_activity", userId, username,
       `创建促销活动: ${activityCode}, 名称: ${body.activityName}`, tenantId]
    );
  });

  return { activity_code: activityCode };
}

export async function updatePromotion(
  activityId: number,
  body: {
    activityName?: string;
    activityDesc?: string;
    startTime?: string;
    endTime?: string;
    applicableScope?: string;
    applicableIds?: any;
    rules?: any;
    maxParticipants?: number;
    priority?: number;
    stackable?: number;
    status?: string;
  },
  tenantId: string,
  userId: number,
  username: string
) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id, status FROM promotion_activity WHERE id = ?",
    [activityId],
    tenantId
  );

  if (!existing) {
    throw Object.assign(new Error("促销活动不存在"), { statusCode: 404 });
  }

  const updates: string[] = [];
  const params: any[] = [];

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
      `UPDATE promotion_activity SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params,
      tenantId
    );

    await queryWithTenant(
      `INSERT INTO marketing_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["promotion", "UPDATE", String(activityId), "promotion_activity", userId, username,
       `更新促销活动: ${activityId}`, tenantId],
      tenantId
    );
  }

  return { activity_id: activityId };
}

export async function calculateDiscount(
  body: {
    userId: number;
    orderAmount: number;
    productIds: number[];
    couponNo?: string;
  },
  tenantId: string
) {
  let userCoupon: any = null;
  if (body.couponNo) {
    userCoupon = await queryOneWithTenant<any>(
      `SELECT id, coupon_type, coupon_value, min_purchase, max_discount,
              applicable_scope, applicable_ids, valid_start, valid_end
       FROM user_coupon
       WHERE coupon_no = ? AND user_id = ? AND status = 'UNUSED'`,
      [body.couponNo, body.userId],
      tenantId
    );

    if (!userCoupon) {
      throw Object.assign(new Error("优惠券不存在或已使用"), { statusCode: 400 });
    }

    const now = new Date();
    if (now < new Date(userCoupon.valid_start) || now > new Date(userCoupon.valid_end)) {
      throw Object.assign(new Error("优惠券已过期"), { statusCode: 400 });
    }

    if (body.orderAmount < userCoupon.min_purchase) {
      throw Object.assign(new Error(`订单金额需满${userCoupon.min_purchase}元`), { statusCode: 400 });
    }
  }

  const promotions = await queryWithTenant<any>(
    `SELECT id, activity_type, rules, applicable_scope, applicable_ids, priority, stackable
     FROM promotion_activity
     WHERE status = 'ACTIVE'
       AND start_time <= NOW() AND end_time >= NOW()
     ORDER BY priority DESC`,
    [],
    tenantId
  );

  let promotionDiscount = 0;
  let appliedPromotions: any[] = [];

  for (const promo of promotions) {
    if (promo.applicable_scope !== "ALL") {
      const applicableIds = JSON.parse(promo.applicable_ids || "[]");
      const hasMatch = body.productIds.some(id => applicableIds.includes(id));
      if (!hasMatch) continue;
    }

    const rules = JSON.parse(promo.rules);

    if (promo.activity_type === "FULL_REDUCTION") {
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
    if (userCoupon.coupon_type === "AMOUNT") {
      couponDiscount = userCoupon.coupon_value;
    } else if (userCoupon.coupon_type === "DISCOUNT") {
      couponDiscount = body.orderAmount * (1 - userCoupon.coupon_value);
      if (userCoupon.max_discount && couponDiscount > userCoupon.max_discount) {
        couponDiscount = userCoupon.max_discount;
      }
    }
  }

  const totalDiscount = promotionDiscount + couponDiscount;
  const finalAmount = Math.max(0, body.orderAmount - totalDiscount);

  return {
    original_amount: body.orderAmount,
    promotion_discount: promotionDiscount,
    coupon_discount: couponDiscount,
    total_discount: totalDiscount,
    final_amount: finalAmount,
    applied_promotions: appliedPromotions,
    used_coupon: userCoupon ? { coupon_no: body.couponNo, discount: couponDiscount } : null
  };
}
