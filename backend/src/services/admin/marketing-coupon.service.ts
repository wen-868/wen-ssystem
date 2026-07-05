import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";

export async function createCouponTemplate(body: {
  name: string;
  type: string;
  value: number;
  minAmount: number;
  maxDiscount: number | null;
  applicableScope: string;
  applicableIds: number[] | null;
  totalCount: number;
  startTime: string;
  endTime: string;
  description: string;
}, tenantId: string) {
  await queryWithTenant(
    `INSERT INTO coupon_template (name, type, value, min_amount, max_discount,
        applicable_scope, applicable_ids, total_count, start_time, end_time, description, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.name, body.type, body.value, body.minAmount, body.maxDiscount,
      body.applicableScope, JSON.stringify(body.applicableIds), body.totalCount,
      body.startTime, body.endTime, body.description, tenantId
    ],
    tenantId
  );

  const record = await queryOneWithTenant<any>(
    `SELECT id, name, type, value, min_amount AS minAmount, max_discount AS maxDiscount,
              applicable_scope AS applicableScope, applicable_ids AS applicableIds,
              total_count AS totalCount, claimed_count AS claimedCount, used_count AS usedCount,
              start_time AS startTime, end_time AS endTime, status, description,
              created_at AS createdAt, updated_at AS updatedAt
       FROM coupon_template ORDER BY id DESC LIMIT 1`,
    [],
    tenantId
  );

  return record;
}

export async function listCouponTemplates(
  page: number,
  pageSize: number,
  tenantId: string,
  status?: string,
  type?: string,
  keyword?: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    conditions.push("ct.status = ?");
    params.push(status);
  }
  if (type) {
    conditions.push("ct.type = ?");
    params.push(type);
  }
  if (keyword) {
    conditions.push("ct.name LIKE ?");
    params.push(`%${keyword}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<any>(
    `SELECT ct.id, ct.name, ct.type, ct.value, ct.min_amount AS minAmount,
              ct.max_discount AS maxDiscount, ct.applicable_scope AS applicableScope,
              ct.applicable_ids AS applicableIds, ct.total_count AS totalCount,
              ct.claimed_count AS claimedCount, ct.used_count AS usedCount,
              ct.start_time AS startTime, ct.end_time AS endTime, ct.status,
              ct.description, ct.created_at AS createdAt, ct.updated_at AS updatedAt
       FROM coupon_template ct
       ${where}
       ORDER BY ct.created_at DESC
       LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM coupon_template ct ${where}`,
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

export async function getCouponTemplate(id: number, tenantId: string) {
  const record = await queryOneWithTenant<any>(
    `SELECT id, name, type, value, min_amount AS minAmount, max_discount AS maxDiscount,
            applicable_scope AS applicableScope, applicable_ids AS applicableIds,
            total_count AS totalCount, claimed_count AS claimedCount, used_count AS usedCount,
            start_time AS startTime, end_time AS endTime, status, description,
            created_at AS createdAt, updated_at AS updatedAt
     FROM coupon_template WHERE id = ?`,
    [id],
    tenantId
  );
  if (!record) {
    throw Object.assign(new Error("优惠券模板不存在"), { statusCode: 404 });
  }
  return record;
}

export async function updateCouponTemplate(id: number, body: {
  name?: string;
  type?: string;
  value?: number;
  minAmount?: number;
  maxDiscount?: number | null;
  applicableScope?: string;
  applicableIds?: number[] | null;
  totalCount?: number;
  startTime?: string;
  endTime?: string;
  description?: string;
}, tenantId: string) {
  const existing = await queryOneWithTenant<any>("SELECT id, status FROM coupon_template WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("优惠券模板不存在"), { statusCode: 404 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.name !== undefined) { updates.push("name = ?"); params.push(body.name); }
  if (body.type !== undefined) { updates.push("type = ?"); params.push(body.type); }
  if (body.value !== undefined) { updates.push("value = ?"); params.push(body.value); }
  if (body.minAmount !== undefined) { updates.push("min_amount = ?"); params.push(body.minAmount); }
  if (body.maxDiscount !== undefined) { updates.push("max_discount = ?"); params.push(body.maxDiscount); }
  if (body.applicableScope !== undefined) { updates.push("applicable_scope = ?"); params.push(body.applicableScope); }
  if (body.applicableIds !== undefined) { updates.push("applicable_ids = ?"); params.push(JSON.stringify(body.applicableIds)); }
  if (body.totalCount !== undefined) { updates.push("total_count = ?"); params.push(body.totalCount); }
  if (body.startTime !== undefined) { updates.push("start_time = ?"); params.push(body.startTime); }
  if (body.endTime !== undefined) { updates.push("end_time = ?"); params.push(body.endTime); }
  if (body.description !== undefined) { updates.push("description = ?"); params.push(body.description); }

  if (updates.length > 0) {
    params.push(id);
    await queryWithTenant(`UPDATE coupon_template SET ${updates.join(", ")} WHERE id = ?`, params, tenantId);
  }

  const record = await queryOneWithTenant<any>(
    `SELECT id, name, type, value, min_amount AS minAmount, max_discount AS maxDiscount,
            applicable_scope AS applicableScope, applicable_ids AS applicableIds,
            total_count AS totalCount, claimed_count AS claimedCount, used_count AS usedCount,
            start_time AS startTime, end_time AS endTime, status, description,
            created_at AS createdAt, updated_at AS updatedAt
     FROM coupon_template WHERE id = ?`,
    [id],
    tenantId
  );

  return record;
}

export async function deleteCouponTemplate(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>("SELECT id, status FROM coupon_template WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("优惠券模板不存在"), { statusCode: 404 });
  }
  if (existing.status !== "DRAFT") {
    throw Object.assign(new Error("仅草稿状态的优惠券模板可删除"), { statusCode: 400 });
  }

  await queryWithTenant("DELETE FROM coupon_template WHERE id = ?", [id], tenantId);
  return { id, deleted: true };
}

export async function activateCouponTemplate(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>("SELECT id, status FROM coupon_template WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("优惠券模板不存在"), { statusCode: 404 });
  }
  if (!["DRAFT", "PAUSED"].includes(existing.status)) {
    throw Object.assign(new Error("仅草稿或暂停状态的优惠券可激活"), { statusCode: 400 });
  }

  await queryWithTenant("UPDATE coupon_template SET status = 'ACTIVE' WHERE id = ?", [id], tenantId);
  return { id, status: "ACTIVE" };
}

export async function pauseCouponTemplate(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>("SELECT id, status FROM coupon_template WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("优惠券模板不存在"), { statusCode: 404 });
  }
  if (existing.status !== "ACTIVE") {
    throw Object.assign(new Error("仅激活状态的优惠券可暂停"), { statusCode: 400 });
  }

  await queryWithTenant("UPDATE coupon_template SET status = 'PAUSED' WHERE id = ?", [id], tenantId);
  return { id, status: "PAUSED" };
}

export async function listUserCoupons(
  page: number,
  pageSize: number,
  tenantId: string,
  status?: string,
  userId?: number,
  templateId?: number
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["ct.tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (status) {
    conditions.push("uc.status = ?");
    params.push(status);
  }
  if (userId) {
    conditions.push("uc.user_id = ?");
    params.push(userId);
  }
  if (templateId) {
    conditions.push("uc.template_id = ?");
    params.push(templateId);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const records = await queryWithTenant<any>(
    `SELECT uc.id, uc.template_id AS templateId, uc.user_id AS userId, uc.order_id AS orderId,
            uc.status, uc.claimed_at AS claimedAt, uc.used_at AS usedAt,
            uc.expires_at AS expiresAt, uc.created_at AS createdAt,
            ct.name AS templateName, ct.type AS couponType, ct.value AS couponValue,
            ct.min_amount AS minAmount, ct.applicable_scope AS applicableScope
     FROM user_coupon uc
     JOIN coupon_template ct ON ct.id = uc.template_id AND ct.tenant_id = ?
     ${where}
     ORDER BY uc.claimed_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM user_coupon uc
     JOIN coupon_template ct ON ct.id = uc.template_id AND ct.tenant_id = ?
     ${where}`,
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

export async function getCouponStatistics(tenantId: string) {
  const byType = await queryWithTenant<any>(
    `SELECT type, COUNT(*) AS templateCount,
            SUM(total_count) AS totalIssued, SUM(claimed_count) AS totalClaimed, SUM(used_count) AS totalUsed
     FROM coupon_template GROUP BY type`,
    [],
    tenantId
  );

  const overall = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS totalTemplates, SUM(total_count) AS totalIssued,
            SUM(claimed_count) AS totalClaimed, SUM(used_count) AS totalUsed
     FROM coupon_template`,
    [],
    tenantId
  );

  return {
    overall: {
      totalTemplates: Number(overall?.totalTemplates ?? 0),
      totalIssued: Number(overall?.totalIssued ?? 0),
      totalClaimed: Number(overall?.totalClaimed ?? 0),
      totalUsed: Number(overall?.totalUsed ?? 0),
      claimRate: Number(overall?.totalIssued) > 0
        ? (Number(overall?.totalClaimed) / Number(overall?.totalIssued) * 100).toFixed(2) + "%"
        : "0%",
      useRate: Number(overall?.totalClaimed) > 0
        ? (Number(overall?.totalUsed) / Number(overall?.totalClaimed) * 100).toFixed(2) + "%"
        : "0%"
    },
    byType: byType.map((r: any) => ({
      type: r.type,
      templateCount: Number(r.templateCount),
      totalIssued: Number(r.totalIssued),
      totalClaimed: Number(r.totalClaimed),
      totalUsed: Number(r.totalUsed),
      claimRate: Number(r.totalIssued) > 0
        ? (Number(r.totalClaimed) / Number(r.totalIssued) * 100).toFixed(2) + "%"
        : "0%",
      useRate: Number(r.totalClaimed) > 0
        ? (Number(r.totalUsed) / Number(r.totalClaimed) * 100).toFixed(2) + "%"
        : "0%"
    }))
  };
}

export async function listAvailableCoupons(tenantId: string) {
  const now = new Date().toISOString();
  const records = await queryWithTenant<any>(
    `SELECT id, name, type, value, min_amount AS minAmount, max_discount AS maxDiscount,
            applicable_scope AS applicableScope, total_count AS totalCount,
            claimed_count AS claimedCount,
            start_time AS startTime, end_time AS endTime, description
     FROM coupon_template
     WHERE status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
       AND (total_count = 0 OR claimed_count < total_count)
     ORDER BY created_at DESC`,
    [now, now],
    tenantId
  );

  return { total: records.length, records };
}

export async function claimCoupon(templateId: number, userId: number, tenantId: string) {
  const now = new Date().toISOString();

  await transaction(async (conn) => {
    const [templateRows] = await conn.execute(
      `SELECT id, name, type, value, min_amount, max_discount, total_count, claimed_count,
              end_time, status
       FROM coupon_template
       WHERE id = ? AND tenant_id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
       FOR UPDATE`,
      [templateId, tenantId, now, now]
    ) as unknown as Record<string, unknown>[];

    const template = (templateRows as unknown as Record<string, unknown>[])[0];
    if (!template) {
      throw Object.assign(new Error("优惠券不存在或已过期"), { statusCode: 404 });
    }

    if ((template as any).total_count > 0 && (template as any).claimed_count >= (template as any).total_count) {
      throw Object.assign(new Error("优惠券已被领完"), { statusCode: 400 });
    }

    const [existingRows] = await conn.execute(
      `SELECT uc.id FROM user_coupon uc
       JOIN coupon_template ct ON ct.id = uc.template_id AND ct.tenant_id = ?
       WHERE uc.template_id = ? AND uc.user_id = ? AND uc.status = 'AVAILABLE'`,
      [tenantId, templateId, userId]
    ) as unknown as Record<string, unknown>[];

    if ((existingRows as unknown as Record<string, unknown>[]).length > 0) {
      throw Object.assign(new Error("您已领取过该优惠券"), { statusCode: 400 });
    }

    const endTime = new Date(String(template.end_time));
    const expiresAt = endTime.toISOString();

    await conn.execute(
      `INSERT INTO user_coupon (template_id, user_id, status, expires_at, tenant_id)
       VALUES (?, ?, 'AVAILABLE', ?, ?)`,
      [templateId, userId, expiresAt, tenantId]
    );

    await conn.execute(
      `UPDATE coupon_template SET claimed_count = claimed_count + 1 WHERE id = ? AND tenant_id = ?`,
      [templateId, tenantId]
    );
  });

  const record = await queryOneWithTenant<any>(
    `SELECT uc.id, uc.template_id AS templateId, uc.user_id AS userId,
            uc.status, uc.claimed_at AS claimedAt, uc.expires_at AS expiresAt,
            ct.name AS templateName, ct.type AS couponType, ct.value AS couponValue,
            ct.min_amount AS minAmount, ct.applicable_scope AS applicableScope
     FROM user_coupon uc
     JOIN coupon_template ct ON ct.id = uc.template_id AND ct.tenant_id = ?
     WHERE uc.template_id = ? AND uc.user_id = ?
     ORDER BY uc.id DESC LIMIT 1`,
    [tenantId, templateId, userId],
    tenantId
  );

  return record;
}

export async function listMyCoupons(
  userId: number,
  page: number,
  pageSize: number,
  tenantId: string,
  status?: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["uc.user_id = ?", "uc.tenant_id = ?"];
  const params: unknown[] = [userId, tenantId];

  if (status) {
    conditions.push("uc.status = ?");
    params.push(status);
  }

  const where = conditions.join(" AND ");

  const records = await queryWithTenant<any>(
    `SELECT uc.id, uc.template_id AS templateId, uc.user_id AS userId,
            uc.order_id AS orderId, uc.status, uc.claimed_at AS claimedAt,
            uc.used_at AS usedAt, uc.expires_at AS expiresAt,
            ct.name AS templateName, ct.type AS couponType, ct.value AS couponValue,
            ct.min_amount AS minAmount, ct.max_discount AS maxDiscount,
            ct.applicable_scope AS applicableScope, ct.description
     FROM user_coupon uc
     JOIN coupon_template ct ON ct.id = uc.template_id AND ct.tenant_id = ?
     WHERE ${where}
     ORDER BY uc.claimed_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, ...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM user_coupon uc WHERE ${where}`,
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
