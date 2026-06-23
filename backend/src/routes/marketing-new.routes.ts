import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const marketingNewRouter = Router();

// ========== 优惠券模板管理 ==========

// 获取优惠券模板列表
marketingNewRouter.get("/coupons", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const { status, type, page = 1, pageSize = 20 } = req.query;

  const conditions: string[] = ["tenant_id = ?"];
  const params: any[] = [tenantId];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (type) {
    conditions.push("coupon_type = ?");
    params.push(type);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
    `SELECT id, template_code AS templateCode, template_name AS templateName,
            coupon_type AS couponType, coupon_value AS couponValue,
            min_purchase AS minPurchase, max_discount AS maxDiscount,
            applicable_scope AS applicableScope, applicable_ids AS applicableIds,
            total_quantity AS totalQuantity, issued_quantity AS issuedQuantity,
            used_quantity AS usedQuantity, per_limit AS perLimit,
            valid_type AS validType, valid_start AS validStart, valid_end AS validEnd,
            valid_days AS validDays, status, description,
            created_at AS createdAt, updated_at AS updatedAt
     FROM coupon_template
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM coupon_template ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page: Number(page),
    pageSize: Number(pageSize),
    records
  }));
}));

// 获取优惠券模板详情
marketingNewRouter.get("/coupons/:templateId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const templateId = Number(req.params.templateId);

  const record = await queryOne<any>(
    `SELECT id, template_code AS templateCode, template_name AS templateName,
            coupon_type AS couponType, coupon_value AS couponValue,
            min_purchase AS minPurchase, max_discount AS maxDiscount,
            applicable_scope AS applicableScope, applicable_ids AS applicableIds,
            total_quantity AS totalQuantity, issued_quantity AS issuedQuantity,
            used_quantity AS usedQuantity, per_limit AS perLimit,
            valid_type AS validType, valid_start AS validStart, valid_end AS validEnd,
            valid_days AS validDays, status, description,
            created_at AS createdAt, updated_at AS updatedAt
     FROM coupon_template
     WHERE id = ? AND tenant_id = ?`,
    [templateId, tenantId]
  );

  if (!record) {
    res.status(404).json({ code: "404", message: "优惠券模板不存在" });
    return;
  }

  res.json(ok(record));
}));

// 创建优惠券模板
marketingNewRouter.post("/coupons", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;

  const body = z.object({
    templateName: z.string().min(1).max(128),
    couponType: z.enum(["AMOUNT", "DISCOUNT", "GIFT"]),
    couponValue: z.number().min(0),
    minPurchase: z.number().min(0).default(0),
    maxDiscount: z.number().min(0).optional(),
    applicableScope: z.enum(["ALL", "CATEGORY", "PRODUCT", "STORE"]).default("ALL"),
    applicableIds: z.any().optional(),
    totalQuantity: z.number().int().min(0).default(0),
    perLimit: z.number().int().min(1).default(1),
    validType: z.enum(["FIXED", "DAYS"]),
    validStart: z.string().optional(),
    validEnd: z.string().optional(),
    validDays: z.number().int().min(1).optional(),
    description: z.string().max(500).optional(),
  }).parse(req.body);

  const templateCode = makeBizNo("COUPON");

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO coupon_template (
        template_code, template_name, coupon_type, coupon_value,
        min_purchase, max_discount, applicable_scope, applicable_ids,
        total_quantity, per_limit, valid_type, valid_start, valid_end, valid_days,
        description, status, tenant_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`,
      [
        templateCode, body.templateName, body.couponType, body.couponValue,
        body.minPurchase, body.maxDiscount || null, body.applicableScope,
        body.applicableIds ? JSON.stringify(body.applicableIds) : null,
        body.totalQuantity, body.perLimit, body.validType,
        body.validStart || null, body.validEnd || null, body.validDays || null,
        body.description || null, tenantId, req.user!.id
      ]
    );

    await conn.execute(
      `INSERT INTO marketing_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["coupon", "CREATE", templateCode, "coupon_template", req.user!.id, req.user!.username,
       `创建优惠券模板: ${templateCode}, 名称: ${body.templateName}`, tenantId]
    );
  });

  res.json(ok({ template_code: templateCode }));
}));

// 更新优惠券模板
marketingNewRouter.put("/coupons/:templateId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const templateId = Number(req.params.templateId);

  const body = z.object({
    templateName: z.string().min(1).max(128).optional(),
    couponValue: z.number().min(0).optional(),
    minPurchase: z.number().min(0).optional(),
    maxDiscount: z.number().min(0).optional(),
    applicableScope: z.enum(["ALL", "CATEGORY", "PRODUCT", "STORE"]).optional(),
    applicableIds: z.any().optional(),
    totalQuantity: z.number().int().min(0).optional(),
    perLimit: z.number().int().min(1).optional(),
    validType: z.enum(["FIXED", "DAYS"]).optional(),
    validStart: z.string().optional(),
    validEnd: z.string().optional(),
    validDays: z.number().int().min(1).optional(),
    description: z.string().max(500).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).optional(),
  }).parse(req.body);

  const existing = await queryOne<any>(
    "SELECT id, status FROM coupon_template WHERE id = ? AND tenant_id = ?",
    [templateId, tenantId]
  );

  if (!existing) {
    res.status(404).json({ code: "404", message: "优惠券模板不存在" });
    return;
  }

  const updates: string[] = [];
  const params: any[] = [];

  const fieldMap: Record<string, string> = {
    templateName: "template_name",
    couponValue: "coupon_value",
    minPurchase: "min_purchase",
    maxDiscount: "max_discount",
    applicableScope: "applicable_scope",
    totalQuantity: "total_quantity",
    perLimit: "per_limit",
    validType: "valid_type",
    validStart: "valid_start",
    validEnd: "valid_end",
    validDays: "valid_days",
    description: "description",
    status: "status",
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    const value = (body as any)[key];
    if (value !== undefined) {
      updates.push(`${column} = ?`);
      params.push(value);
    }
  }

  if (body.applicableIds !== undefined) {
    updates.push("applicable_ids = ?");
    params.push(JSON.stringify(body.applicableIds));
  }

  if (updates.length > 0) {
    params.push(templateId, tenantId);
    await query(
      `UPDATE coupon_template SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      params
    );

    await query(
      `INSERT INTO marketing_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["coupon", "UPDATE", String(templateId), "coupon_template", req.user!.id, req.user!.username,
       `更新优惠券模板: ${templateId}`, tenantId]
    );
  }

  res.json(ok({ template_id: templateId }));
}));

// 发放优惠券给用户
marketingNewRouter.post("/coupons/:templateId/issue", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const templateId = Number(req.params.templateId);

  const body = z.object({
    userIds: z.array(z.number().int().positive()).min(1),
  }).parse(req.body);

  const template = await queryOne<any>(
    `SELECT id, template_code, template_name, coupon_type, coupon_value,
            min_purchase, max_discount, applicable_scope, applicable_ids,
            total_quantity, issued_quantity, per_limit, valid_type,
            valid_start, valid_end, valid_days, status
     FROM coupon_template
     WHERE id = ? AND tenant_id = ?`,
    [templateId, tenantId]
  );

  if (!template) {
    res.status(404).json({ code: "404", message: "优惠券模板不存在" });
    return;
  }

  if (template.status !== "ACTIVE") {
    res.status(400).json({ code: "400", message: "优惠券模板未激活" });
    return;
  }

  if (template.total_quantity > 0 && template.issued_quantity >= template.total_quantity) {
    res.status(400).json({ code: "400", message: "优惠券已发完" });
    return;
  }

  const issuedCoupons: string[] = [];

  await transaction(async (conn) => {
    for (const userId of body.userIds) {
      // 检查用户是否已达到领取上限
      const userCouponCount = await queryOne<any>(
        `SELECT COUNT(*) AS count FROM user_coupon
         WHERE template_id = ? AND user_id = ? AND tenant_id = ?`,
        [templateId, userId, tenantId]
      );

      if (userCouponCount && userCouponCount.count >= template.per_limit) {
        continue; // 跳过已达到上限的用户
      }

      const couponNo = makeBizNo("UC");
      let validStart: Date;
      let validEnd: Date;

      if (template.valid_type === "FIXED") {
        validStart = new Date(template.valid_start);
        validEnd = new Date(template.valid_end);
      } else {
        validStart = new Date();
        validEnd = new Date();
        validEnd.setDate(validEnd.getDate() + template.valid_days);
      }

      await conn.execute(
        `INSERT INTO user_coupon (
          coupon_no, template_id, user_id, coupon_type, coupon_name,
          coupon_value, min_purchase, max_discount, applicable_scope, applicable_ids,
          source, status, valid_start, valid_end, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVE', 'UNUSED', ?, ?, ?)`,
        [
          couponNo, templateId, userId, template.coupon_type, template.template_name,
          template.coupon_value, template.min_purchase, template.max_discount,
          template.applicable_scope, template.applicable_ids,
          validStart.toISOString().slice(0, 19).replace("T", " "),
          validEnd.toISOString().slice(0, 19).replace("T", " "),
          tenantId
        ]
      );

      issuedCoupons.push(couponNo);
    }

    // 更新已发行数量
    await conn.execute(
      "UPDATE coupon_template SET issued_quantity = issued_quantity + ? WHERE id = ?",
      [issuedCoupons.length, templateId]
    );

    await conn.execute(
      `INSERT INTO marketing_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["coupon", "ISSUE", String(templateId), "coupon_template", req.user!.id, req.user!.username,
       `发放优惠券: ${template.template_name}, 数量: ${issuedCoupons.length}`, tenantId]
    );
  });

  res.json(ok({ issued_count: issuedCoupons.length, coupon_nos: issuedCoupons }));
}));

// ========== 用户优惠券管理 ==========

// 获取用户优惠券列表
marketingNewRouter.get("/user-coupons", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const { userId, status, page = 1, pageSize = 20 } = req.query;

  const conditions: string[] = ["uc.tenant_id = ?"];
  const params: any[] = [tenantId];

  if (userId) {
    conditions.push("uc.user_id = ?");
    params.push(Number(userId));
  }
  if (status) {
    conditions.push("uc.status = ?");
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
    `SELECT uc.id, uc.coupon_no AS couponNo, uc.template_id AS templateId,
            uc.user_id AS userId, uc.coupon_type AS couponType,
            uc.coupon_name AS couponName, uc.coupon_value AS couponValue,
            uc.min_purchase AS minPurchase, uc.max_discount AS maxDiscount,
            uc.applicable_scope AS applicableScope, uc.applicable_ids AS applicableIds,
            uc.source, uc.status, uc.valid_start AS validStart, uc.valid_end AS validEnd,
            uc.used_at AS usedAt, uc.used_order_no AS usedOrderNo,
            uc.used_amount AS usedAmount, uc.discount_amount AS discountAmount,
            uc.created_at AS createdAt
     FROM user_coupon uc
     ${where}
     ORDER BY uc.valid_end ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM user_coupon uc ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page: Number(page),
    pageSize: Number(pageSize),
    records
  }));
}));

// ========== 促销活动管理 ==========

// 获取促销活动列表
marketingNewRouter.get("/promotions", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const { type, status, page = 1, pageSize = 20 } = req.query;

  const conditions: string[] = ["tenant_id = ?"];
  const params: any[] = [tenantId];

  if (type) {
    conditions.push("activity_type = ?");
    params.push(type);
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
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
    [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM promotion_activity ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page: Number(page),
    pageSize: Number(pageSize),
    records
  }));
}));

// 创建促销活动
marketingNewRouter.post("/promotions", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;

  const body = z.object({
    activityName: z.string().min(1).max(128),
    activityType: z.enum(["FULL_REDUCTION", "SECKILL", "GROUP_BUY", "GIFT"]),
    activityDesc: z.string().max(500).optional(),
    startTime: z.string(),
    endTime: z.string(),
    applicableScope: z.enum(["ALL", "CATEGORY", "PRODUCT", "STORE"]).default("ALL"),
    applicableIds: z.any().optional(),
    rules: z.any(),
    maxParticipants: z.number().int().min(0).default(0),
    priority: z.number().int().default(0),
    stackable: z.number().int().min(0).max(1).default(0),
  }).parse(req.body);

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
        tenantId, req.user!.id
      ]
    );

    await conn.execute(
      `INSERT INTO marketing_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["promotion", "CREATE", activityCode, "promotion_activity", req.user!.id, req.user!.username,
       `创建促销活动: ${activityCode}, 名称: ${body.activityName}`, tenantId]
    );
  });

  res.json(ok({ activity_code: activityCode }));
}));

// 更新促销活动
marketingNewRouter.put("/promotions/:activityId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const activityId = Number(req.params.activityId);

  const body = z.object({
    activityName: z.string().min(1).max(128).optional(),
    activityDesc: z.string().max(500).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    applicableScope: z.enum(["ALL", "CATEGORY", "PRODUCT", "STORE"]).optional(),
    applicableIds: z.any().optional(),
    rules: z.any().optional(),
    maxParticipants: z.number().int().min(0).optional(),
    priority: z.number().int().optional(),
    stackable: z.number().int().min(0).max(1).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ENDED"]).optional(),
  }).parse(req.body);

  const existing = await queryOne<any>(
    "SELECT id, status FROM promotion_activity WHERE id = ? AND tenant_id = ?",
    [activityId, tenantId]
  );

  if (!existing) {
    res.status(404).json({ code: "404", message: "促销活动不存在" });
    return;
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
    const value = (body as any)[key];
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
    params.push(activityId, tenantId);
    await query(
      `UPDATE promotion_activity SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      params
    );

    await query(
      `INSERT INTO marketing_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["promotion", "UPDATE", String(activityId), "promotion_activity", req.user!.id, req.user!.username,
       `更新促销活动: ${activityId}`, tenantId]
    );
  }

  res.json(ok({ activity_id: activityId }));
}));

// ========== 计算订单优惠 ==========

// 计算订单可用优惠
marketingNewRouter.post("/calculate-discount", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;

  const body = z.object({
    userId: z.number().int().positive(),
    orderAmount: z.number().min(0),
    productIds: z.array(z.number().int().positive()),
    couponNo: z.string().optional(),
  }).parse(req.body);

  // 1. 查询用户可用优惠券
  let userCoupon: any = null;
  if (body.couponNo) {
    userCoupon = await queryOne<any>(
      `SELECT id, coupon_type, coupon_value, min_purchase, max_discount,
              applicable_scope, applicable_ids, valid_start, valid_end
       FROM user_coupon
       WHERE coupon_no = ? AND user_id = ? AND tenant_id = ? AND status = 'UNUSED'`,
      [body.couponNo, body.userId, tenantId]
    );

    if (!userCoupon) {
      res.status(400).json({ code: "400", message: "优惠券不存在或已使用" });
      return;
    }

    // 检查有效期
    const now = new Date();
    if (now < new Date(userCoupon.valid_start) || now > new Date(userCoupon.valid_end)) {
      res.status(400).json({ code: "400", message: "优惠券已过期" });
      return;
    }

    // 检查最低消费
    if (body.orderAmount < userCoupon.min_purchase) {
      res.status(400).json({ code: "400", message: `订单金额需满${userCoupon.min_purchase}元` });
      return;
    }
  }

  // 2. 查询当前有效的促销活动
  const promotions = await query<any>(
    `SELECT id, activity_type, rules, applicable_scope, applicable_ids, priority, stackable
     FROM promotion_activity
     WHERE tenant_id = ? AND status = 'ACTIVE'
       AND start_time <= NOW() AND end_time >= NOW()
     ORDER BY priority DESC`,
    [tenantId]
  );

  let promotionDiscount = 0;
  let appliedPromotions: any[] = [];

  // 3. 计算促销优惠
  for (const promo of promotions) {
    // 检查适用范围
    if (promo.applicable_scope !== "ALL") {
      const applicableIds = JSON.parse(promo.applicable_ids || "[]");
      const hasMatch = body.productIds.some(id => applicableIds.includes(id));
      if (!hasMatch) continue;
    }

    const rules = JSON.parse(promo.rules);

    if (promo.activity_type === "FULL_REDUCTION") {
      // 满减规则
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
    } else if (promo.activity_type === "SECKILL") {
      // 秒杀优惠（需要单独处理，这里简化处理）
      // 实际应该根据商品ID查询秒杀价格
    }

    if (!promo.stackable && appliedPromotions.length > 0) {
      break; // 不可叠加，只取第一个
    }
  }

  // 4. 计算优惠券优惠
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

  // 5. 计算总优惠
  const totalDiscount = promotionDiscount + couponDiscount;
  const finalAmount = Math.max(0, body.orderAmount - totalDiscount);

  res.json(ok({
    original_amount: body.orderAmount,
    promotion_discount: promotionDiscount,
    coupon_discount: couponDiscount,
    total_discount: totalDiscount,
    final_amount: finalAmount,
    applied_promotions: appliedPromotions,
    used_coupon: userCoupon ? { coupon_no: body.couponNo, discount: couponDiscount } : null
  }));
}));
