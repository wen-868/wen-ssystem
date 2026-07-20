import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

export async function getPointsRule(tenantId: string) {
  const record = await queryOneWithTenant<any>(
    `SELECT id, earn_ratio AS earnRatio, redeem_ratio AS redeemRatio,
            min_redeem_amount AS minRedeemAmount, max_redeem_ratio AS maxRedeemRatio,
            expire_days AS expireDays, enabled, created_at AS createdAt, updated_at AS updatedAt
     FROM t_points_rule`,
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
  const existing = await queryOneWithTenant<any>("SELECT id FROM t_points_rule", [], tenantId);

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
      await queryWithTenant(`UPDATE t_points_rule SET ${updates.join(", ")} WHERE id = ?`, params, tenantId);
    }
  } else {
    await queryWithTenant(
      `INSERT INTO t_points_rule (earn_ratio, redeem_ratio, min_redeem_amount, max_redeem_ratio, expire_days, enabled, tenant_id)
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
     FROM t_points_rule`,
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
     FROM t_points_record
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_points_record ${where}`,
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
     FROM t_user_points WHERE user_id = ?`,
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
     FROM t_points_record
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_points_record WHERE ${where}`,
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

// ========== 积分明细（带日期范围） ==========
export async function getPointsRecords(params: {
  tenantId: string;
  userId?: number;
  type?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}) {
  const { tenantId, userId, type, startDate, endDate, page, pageSize } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const paramsList: unknown[] = [tenantId];

  if (userId) { conditions.push("user_id = ?"); paramsList.push(userId); }
  if (type) { conditions.push("type = ?"); paramsList.push(type); }
  if (startDate) { conditions.push("created_at >= ?"); paramsList.push(startDate); }
  if (endDate) { conditions.push("created_at <= ?"); paramsList.push(endDate); }

  const where = conditions.join(" AND ");

  const records = await queryWithTenant<any>(
    `SELECT pr.id, pr.user_id AS userId, pr.type, pr.amount, pr.balance,
            pr.source_type AS sourceType, pr.source_id AS sourceId,
            pr.remark, pr.created_at AS createdAt,
            uc.name AS userName, uc.phone AS phone
     FROM t_points_record pr
     LEFT JOIN t_user_customer uc ON uc.id = pr.user_id AND uc.tenant_id = pr.tenant_id
     WHERE ${where}
     ORDER BY pr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...paramsList, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(`SELECT COUNT(*) AS total FROM t_points_record WHERE ${where}`, paramsList, tenantId);

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

// ========== 积分兑换 ==========
export async function createPointsRedeem(params: {
  tenantId: string;
  userId: number;
  points: number;
  orderId?: number;
  remark?: string;
}) {
  const { tenantId, userId, points, orderId, remark } = params;

  // 获取用户当前积分
  const userPoints = await getUserPoints(userId, tenantId);
  if (!userPoints || userPoints.points < points) {
    throw new Error("积分不足");
  }

  // 获取积分规则
  const rule = await getPointsRule(tenantId);
  const redeemAmount = Math.floor(points / (rule?.redeemRatio ?? 100));

  // 扣减积分
  const newBalance = Number(userPoints.points) - points;
  await queryWithTenant(
    `UPDATE t_user_points 
     SET points = ?, total_spent = total_spent + ? 
     WHERE user_id = ?`,
    [newBalance, points, userId],
    tenantId
  );

  // 记录积分变动
  await queryWithTenant(
    `INSERT INTO t_points_record (user_id, type, amount, balance, source_type, source_id, remark, tenant_id)
     VALUES (?, 'SPEND', ?, ?, 'REDEEM', ?, ?, ?)`,
    [userId, -points, newBalance, orderId ?? null, remark ?? "积分兑换", tenantId],
    tenantId
  );

  return {
    userId,
    points,
    redeemAmount,
    balance: newBalance
  };
}

// ========== 积分统计 ==========
export async function getPointsStats(tenantId: string) {
  const totalPoints = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(points), 0) AS total FROM t_user_points WHERE tenant_id = ?`,
    [tenantId], tenantId
  );

  const todayEarned = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM t_points_record WHERE tenant_id = ? AND type = 'EARN' AND DATE(created_at) = CURDATE()`,
    [tenantId], tenantId
  );

  const todaySpent = await queryOneWithTenant<any>(
    `SELECT COALESCE(SUM(ABS(amount)), 0) AS total FROM t_points_record WHERE tenant_id = ? AND type = 'SPEND' AND DATE(created_at) = CURDATE()`,
    [tenantId], tenantId
  );

  const userCount = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_user_points WHERE tenant_id = ? AND points > 0`,
    [tenantId], tenantId
  );

  return {
    totalPoints: totalPoints?.total ?? 0,
    todayEarned: todayEarned?.total ?? 0,
    todaySpent: todaySpent?.total ?? 0,
    userCount: userCount?.total ?? 0
  };
}
