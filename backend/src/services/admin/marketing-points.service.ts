import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

export async function getPointsRule(tenantId: string) {
  const record = await queryOneWithTenant<any>(
    `SELECT id, earn_ratio AS earnRatio, redeem_ratio AS redeemRatio,
            min_redeem_amount AS minRedeemAmount, max_redeem_ratio AS maxRedeemRatio,
            expire_days AS expireDays, enabled, created_at AS createdAt, updated_at AS updatedAt
     FROM points_rule`,
    [],
    tenantId
  );
  return record;
}

export async function updatePointsRule(body: {
  earnRatio?: number;
  redeemRatio?: number;
  minRedeemAmount?: number;
  maxRedeemRatio?: number;
  expireDays?: number;
  enabled?: boolean;
}, tenantId: string) {
  const existing = await queryOneWithTenant<any>("SELECT id FROM points_rule", [], tenantId);

  if (existing) {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (body.earnRatio !== undefined) { updates.push("earn_ratio = ?"); params.push(body.earnRatio); }
    if (body.redeemRatio !== undefined) { updates.push("redeem_ratio = ?"); params.push(body.redeemRatio); }
    if (body.minRedeemAmount !== undefined) { updates.push("min_redeem_amount = ?"); params.push(body.minRedeemAmount); }
    if (body.maxRedeemRatio !== undefined) { updates.push("max_redeem_ratio = ?"); params.push(body.maxRedeemRatio); }
    if (body.expireDays !== undefined) { updates.push("expire_days = ?"); params.push(body.expireDays); }
    if (body.enabled !== undefined) { updates.push("enabled = ?"); params.push(body.enabled ? 1 : 0); }

    if (updates.length > 0) {
      params.push(existing.id);
      await queryWithTenant(`UPDATE points_rule SET ${updates.join(", ")} WHERE id = ?`, params, tenantId);
    }
  } else {
    await queryWithTenant(
      `INSERT INTO points_rule (earn_ratio, redeem_ratio, min_redeem_amount, max_redeem_ratio, expire_days, enabled, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        body.earnRatio ?? 1,
        body.redeemRatio ?? 100,
        body.minRedeemAmount ?? 0,
        body.maxRedeemRatio ?? 0.5,
        body.expireDays ?? 365,
        body.enabled ?? false,
        tenantId
      ],
      tenantId
    );
  }

  const record = await queryOneWithTenant<any>(
    `SELECT id, earn_ratio AS earnRatio, redeem_ratio AS redeemRatio,
            min_redeem_amount AS minRedeemAmount, max_redeem_ratio AS maxRedeemRatio,
            expire_days AS expireDays, enabled, created_at AS createdAt, updated_at AS updatedAt
     FROM points_rule`,
    [],
    tenantId
  );

  return record;
}

export async function listPointsRecords(
  page: number,
  pageSize: number,
  tenantId: string,
  userId?: number,
  type?: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (userId) {
    conditions.push("user_id = ?");
    params.push(userId);
  }
  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<any>(
    `SELECT id, user_id AS userId, type, amount, balance,
            source_type AS sourceType, source_id AS sourceId,
            remark, created_at AS createdAt
     FROM points_record
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM points_record ${where}`,
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

export async function getUserPoints(userId: number, tenantId: string) {
  const record = await queryOneWithTenant<any>(
    `SELECT id, user_id AS userId, points, total_earned AS totalEarned,
            total_spent AS totalSpent, updated_at AS updatedAt
     FROM user_points WHERE user_id = ?`,
    [userId],
    tenantId
  );
  return record ?? { userId, points: 0, totalEarned: 0, totalSpent: 0 };
}

export async function listMyPointsRecords(
  userId: number,
  page: number,
  pageSize: number,
  tenantId: string,
  type?: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["user_id = ?"];
  const params: unknown[] = [userId];

  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }

  const where = conditions.join(" AND ");

  const records = await queryWithTenant<any>(
    `SELECT id, user_id AS userId, type, amount, balance,
            source_type AS sourceType, source_id AS sourceId,
            remark, created_at AS createdAt
     FROM points_record
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM points_record WHERE ${where}`,
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
