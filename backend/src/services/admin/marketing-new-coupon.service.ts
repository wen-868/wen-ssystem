import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

export async function listCouponTemplates(
  page: number,
  pageSize: number,
  tenantId: string,
  status?: string,
  type?: string
) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (type) {
    conditions.push("coupon_type = ?");
    params.push(type);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<any>(
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
    [...params, pageSize, (page - 1) * pageSize],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM coupon_template ${where}`,
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

export async function getCouponTemplate(templateId: number, tenantId: string) {
  const record = await queryOneWithTenant<any>(
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
     WHERE id = ?`,
    [templateId],
    tenantId
  );

  if (!record) {
    throw Object.assign(new Error("优惠券模板不存在"), { statusCode: 404 });
  }

  return record;
}

export async function createCouponTemplate(body: {
  templateName: string;
  couponType: string;
  couponValue: number;
  minPurchase: number;
  maxDiscount?: number | null;
  applicableScope: string;
  applicableIds?: any;
  totalQuantity: number;
  perLimit: number;
  validType: string;
  validStart?: string;
  validEnd?: string;
  validDays?: number;
  description?: string;
}, tenantId: string, userId: number, username: string) {
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
        body.description || null, tenantId, userId
      ]
    );

    await conn.execute(
      `INSERT INTO marketing_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["coupon", "CREATE", templateCode, "coupon_template", userId, username,
       `创建优惠券模板: ${templateCode}, 名称: ${body.templateName}`, tenantId]
    );
  });

  return { template_code: templateCode };
}

export async function updateCouponTemplate(
  templateId: number,
  body: {
    templateName?: string;
    couponValue?: number;
    minPurchase?: number;
    maxDiscount?: number | null;
    applicableScope?: string;
    applicableIds?: any;
    totalQuantity?: number;
    perLimit?: number;
    validType?: string;
    validStart?: string;
    validEnd?: string;
    validDays?: number;
    description?: string;
    status?: string;
  },
  tenantId: string,
  userId: number,
  username: string
) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id, status FROM coupon_template WHERE id = ?",
    [templateId],
    tenantId
  );

  if (!existing) {
    throw Object.assign(new Error("优惠券模板不存在"), { statusCode: 404 });
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

  if (updates.length > 0) {
    params.push(templateId);
    await queryWithTenant(
      `UPDATE coupon_template SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params,
      tenantId
    );

    await queryWithTenant(
      `INSERT INTO marketing_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["coupon", "UPDATE", String(templateId), "coupon_template", userId, username,
       `更新优惠券模板: ${templateId}`, tenantId],
      tenantId
    );
  }

  return { template_id: templateId };
}

export async function issueCoupons(
  templateId: number,
  userIds: number[],
  tenantId: string,
  userId: number,
  username: string
) {
  const template = await queryOneWithTenant<any>(
    `SELECT id, template_code, template_name, coupon_type, coupon_value,
            min_purchase, max_discount, applicable_scope, applicable_ids,
            total_quantity, issued_quantity, per_limit, valid_type,
            valid_start, valid_end, valid_days, status
     FROM coupon_template
     WHERE id = ?`,
    [templateId],
    tenantId
  );

  if (!template) {
    throw Object.assign(new Error("优惠券模板不存在"), { statusCode: 404 });
  }

  if (template.status !== "ACTIVE") {
    throw Object.assign(new Error("优惠券模板未激活"), { statusCode: 400 });
  }

  if (template.total_quantity > 0 && template.issued_quantity >= template.total_quantity) {
    throw Object.assign(new Error("优惠券已发完"), { statusCode: 400 });
  }

  const issuedCoupons: string[] = [];

  await transaction(async (conn) => {
    for (const uid of userIds) {
      const [userCouponCountRows] = await conn.execute(
        `SELECT COUNT(*) AS count FROM user_coupon
         WHERE template_id = ? AND user_id = ? AND tenant_id = ?`,
        [templateId, uid, tenantId]
      ) as unknown as any[];

      const userCouponCount = (userCouponCountRows as any[])[0];

      if (userCouponCount && userCouponCount.count >= template.per_limit) {
        continue;
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
          couponNo, templateId, uid, template.coupon_type, template.template_name,
          template.coupon_value, template.min_purchase, template.max_discount,
          template.applicable_scope, template.applicable_ids,
          validStart.toISOString().slice(0, 19).replace("T", " "),
          validEnd.toISOString().slice(0, 19).replace("T", " "),
          tenantId
        ]
      );

      issuedCoupons.push(couponNo);
    }

    await conn.execute(
      "UPDATE coupon_template SET issued_quantity = issued_quantity + ? WHERE id = ?",
      [issuedCoupons.length, templateId]
    );

    await conn.execute(
      `INSERT INTO marketing_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["coupon", "ISSUE", String(templateId), "coupon_template", userId, username,
       `发放优惠券: ${template.template_name}, 数量: ${issuedCoupons.length}`, tenantId]
    );
  });

  return { issued_count: issuedCoupons.length, coupon_nos: issuedCoupons };
}

export async function listUserCoupons(
  page: number,
  pageSize: number,
  tenantId: string,
  userId?: number,
  status?: string
) {
  const conditions: string[] = ["uc.tenant_id = ?"];
  const params: any[] = [tenantId];

  if (userId) {
    conditions.push("uc.user_id = ?");
    params.push(userId);
  }
  if (status) {
    conditions.push("uc.status = ?");
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<any>(
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
    [...params, pageSize, (page - 1) * pageSize],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM user_coupon uc ${where}`,
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
