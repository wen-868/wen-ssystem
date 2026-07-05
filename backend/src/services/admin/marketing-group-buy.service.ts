import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";

export async function createGroupBuy(body: {
  name: string;
  productId: number;
  skuId: number;
  groupPrice: number;
  originalPrice: number;
  minGroupSize: number;
  maxGroupSize: number;
  timeLimitHours: number;
  totalStock: number;
  startTime: string;
  endTime: string;
}, tenantId: string) {
  await queryWithTenant(
    `INSERT INTO group_buy (name, product_id, sku_id, group_price, original_price,
        min_group_size, max_group_size, time_limit_hours, total_stock, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.name, body.productId, body.skuId, body.groupPrice, body.originalPrice,
      body.minGroupSize, body.maxGroupSize, body.timeLimitHours, body.totalStock,
      body.startTime, body.endTime
    ],
    tenantId
  );

  const record = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT id, name, product_id AS productId, sku_id AS skuId,
            group_price AS groupPrice, original_price AS originalPrice,
            min_group_size AS minGroupSize, max_group_size AS maxGroupSize,
            time_limit_hours AS timeLimitHours, total_stock AS totalStock,
            sold_count AS soldCount, status,
            start_time AS startTime, end_time AS endTime,
            created_at AS createdAt, updated_at AS updatedAt
     FROM group_buy ORDER BY id DESC LIMIT 1`,
    [],
    tenantId
  );

  return record;
}

export async function listGroupBuys(
  page: number,
  pageSize: number,
  tenantId: string,
  status?: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<Record<string, unknown>>(
    `SELECT id, name, product_id AS productId, sku_id AS skuId,
            group_price AS groupPrice, original_price AS originalPrice,
            min_group_size AS minGroupSize, max_group_size AS maxGroupSize,
            time_limit_hours AS timeLimitHours, total_stock AS totalStock,
            sold_count AS soldCount, status,
            start_time AS startTime, end_time AS endTime,
            created_at AS createdAt, updated_at AS updatedAt
     FROM group_buy
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT COUNT(*) AS total FROM group_buy ${where}`,
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

export async function getGroupBuy(id: number, tenantId: string) {
  const record = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT id, name, product_id AS productId, sku_id AS skuId,
            group_price AS groupPrice, original_price AS originalPrice,
            min_group_size AS minGroupSize, max_group_size AS maxGroupSize,
            time_limit_hours AS timeLimitHours, total_stock AS totalStock,
            sold_count AS soldCount, status,
            start_time AS startTime, end_time AS endTime,
            created_at AS createdAt, updated_at AS updatedAt
     FROM group_buy WHERE id = ?`,
    [id],
    tenantId
  );
  if (!record) {
    throw Object.assign(new Error("拼团活动不存在"), { statusCode: 404 });
  }
  return record;
}

export async function updateGroupBuy(id: number, body: {
  name?: string;
  productId?: number;
  skuId?: number;
  groupPrice?: number;
  originalPrice?: number;
  minGroupSize?: number;
  maxGroupSize?: number;
  timeLimitHours?: number;
  totalStock?: number;
  startTime?: string;
  endTime?: string;
}, tenantId: string) {
  const existing = await queryOneWithTenant<Record<string, unknown>>("SELECT id, status FROM group_buy WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("拼团活动不存在"), { statusCode: 404 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.name !== undefined) { updates.push("name = ?"); params.push(body.name); }
  if (body.productId !== undefined) { updates.push("product_id = ?"); params.push(body.productId); }
  if (body.skuId !== undefined) { updates.push("sku_id = ?"); params.push(body.skuId); }
  if (body.groupPrice !== undefined) { updates.push("group_price = ?"); params.push(body.groupPrice); }
  if (body.originalPrice !== undefined) { updates.push("original_price = ?"); params.push(body.originalPrice); }
  if (body.minGroupSize !== undefined) { updates.push("min_group_size = ?"); params.push(body.minGroupSize); }
  if (body.maxGroupSize !== undefined) { updates.push("max_group_size = ?"); params.push(body.maxGroupSize); }
  if (body.timeLimitHours !== undefined) { updates.push("time_limit_hours = ?"); params.push(body.timeLimitHours); }
  if (body.totalStock !== undefined) { updates.push("total_stock = ?"); params.push(body.totalStock); }
  if (body.startTime !== undefined) { updates.push("start_time = ?"); params.push(body.startTime); }
  if (body.endTime !== undefined) { updates.push("end_time = ?"); params.push(body.endTime); }

  if (updates.length > 0) {
    params.push(id);
    await queryWithTenant(`UPDATE group_buy SET ${updates.join(", ")} WHERE id = ?`, params, tenantId);
  }

  const record = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT id, name, product_id AS productId, sku_id AS skuId,
            group_price AS groupPrice, original_price AS originalPrice,
            min_group_size AS minGroupSize, max_group_size AS maxGroupSize,
            time_limit_hours AS timeLimitHours, total_stock AS totalStock,
            sold_count AS soldCount, status,
            start_time AS startTime, end_time AS endTime,
            created_at AS createdAt, updated_at AS updatedAt
     FROM group_buy WHERE id = ?`,
    [id],
    tenantId
  );

  return record;
}

export async function deleteGroupBuy(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<Record<string, unknown>>("SELECT id, status FROM group_buy WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("拼团活动不存在"), { statusCode: 404 });
  }
  if (existing.status !== "DRAFT") {
    throw Object.assign(new Error("仅草稿状态的拼团活动可删除"), { statusCode: 400 });
  }

  await queryWithTenant("DELETE FROM group_buy WHERE id = ?", [id], tenantId);
  return { id, deleted: true };
}

export async function activateGroupBuy(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<Record<string, unknown>>("SELECT id, status FROM group_buy WHERE id = ?", [id], tenantId);
  if (!existing) {
    throw Object.assign(new Error("拼团活动不存在"), { statusCode: 404 });
  }
  if (!["DRAFT", "PAUSED"].includes(String(existing.status))) {
    throw Object.assign(new Error("仅草稿或暂停状态的活动可激活"), { statusCode: 400 });
  }

  await queryWithTenant("UPDATE group_buy SET status = 'ACTIVE' WHERE id = ?", [id], tenantId);
  return { id, status: "ACTIVE" };
}

export async function listGroupBuyTeams(
  page: number,
  pageSize: number,
  tenantId: string,
  activityId?: number,
  status?: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (activityId) {
    conditions.push("gbt.activity_id = ?");
    params.push(activityId);
  }
  if (status) {
    conditions.push("gbt.status = ?");
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<Record<string, unknown>>(
    `SELECT gbt.id, gbt.activity_id AS activityId, gbt.leader_id AS leaderId,
            gbt.leader_order_id AS leaderOrderId, gbt.current_size AS currentSize,
            gbt.target_size AS targetSize, gbt.status,
            gbt.expires_at AS expiresAt, gbt.created_at AS createdAt, gbt.completed_at AS completedAt,
            gb.name AS activityName, gb.group_price AS groupPrice
     FROM group_buy_team gbt
     JOIN group_buy gb ON gb.id = gbt.activity_id
     ${where}
     ORDER BY gbt.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT COUNT(*) AS total FROM group_buy_team gbt
     JOIN group_buy gb ON gb.id = gbt.activity_id
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

export async function listActiveGroupBuys(tenantId: string) {
  const now = new Date().toISOString();
  const records = await queryWithTenant<Record<string, unknown>>(
    `SELECT id, name, product_id AS productId, sku_id AS skuId,
            group_price AS groupPrice, original_price AS originalPrice,
            min_group_size AS minGroupSize, max_group_size AS maxGroupSize,
            time_limit_hours AS timeLimitHours, total_stock AS totalStock,
            sold_count AS soldCount,
            start_time AS startTime, end_time AS endTime
     FROM group_buy
     WHERE status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
     ORDER BY start_time ASC`,
    [now, now],
    tenantId
  );

  return { total: records.length, records };
}

export async function createGroupBuyTeam(
  activityId: number,
  userId: number,
  quantity: number,
  tenantId: string
) {
  const now = new Date().toISOString();

  const result = await transaction(async (conn) => {
    const [activityRows] = await conn.execute(
      `SELECT id, group_price, min_group_size, max_group_size, time_limit_hours,
              total_stock, sold_count, status, start_time, end_time
       FROM group_buy
       WHERE id = ? AND tenant_id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
       FOR UPDATE`,
      [activityId, tenantId, now, now]
    ) as unknown as Record<string, unknown>[][];

    const activity = (activityRows as unknown as Record<string, unknown>[])[0];
    if (!activity) {
      throw Object.assign(new Error("拼团活动不存在或已结束"), { statusCode: 404 });
    }

    const remaining = Number(activity.total_stock) - Number(activity.sold_count);
    if (remaining < quantity) {
      throw Object.assign(new Error("拼团库存不足"), { statusCode: 400 });
    }

    const expiresAt = new Date(Date.now() + Number(activity.time_limit_hours) * 3600 * 1000).toISOString();

    const [teamResult] = await conn.execute(
      `INSERT INTO group_buy_team (activity_id, leader_id, current_size, target_size, status, expires_at, tenant_id)
       VALUES (?, ?, 1, ?, 'PENDING', ?, ?)`,
      [activityId, userId, activity.min_group_size, expiresAt, tenantId]
    ) as unknown as Record<string, unknown>[][];

    const teamId = (teamResult as unknown as Record<string, unknown>).insertId;

    await conn.execute(
      `INSERT INTO group_buy_member (team_id, user_id, is_leader, tenant_id)
       VALUES (?, ?, 1, ?)`,
      [teamId, userId, tenantId]
    );

    await conn.execute(
      `UPDATE group_buy SET sold_count = sold_count + ? WHERE id = ? AND tenant_id = ?`,
      [quantity, activityId, tenantId]
    );

    const [teamRows] = await conn.execute(
      `SELECT id, activity_id AS activityId, leader_id AS leaderId,
              current_size AS currentSize, target_size AS targetSize,
              status, expires_at AS expiresAt, created_at AS createdAt
       FROM group_buy_team WHERE id = ? AND tenant_id = ?`,
      [teamId, tenantId]
    ) as unknown as Record<string, unknown>[][];

    return (teamRows as unknown as Record<string, unknown>[])[0];
  });

  return result;
}

export async function getGroupBuyTeam(teamId: number, tenantId: string) {
  const team = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT gbt.id, gbt.activity_id AS activityId, gbt.leader_id AS leaderId,
            gbt.leader_order_id AS leaderOrderId, gbt.current_size AS currentSize,
            gbt.target_size AS targetSize, gbt.status,
            gbt.expires_at AS expiresAt, gbt.created_at AS createdAt, gbt.completed_at AS completedAt,
            gb.name AS activityName, gb.group_price AS groupPrice, gb.original_price AS originalPrice
     FROM group_buy_team gbt
     JOIN group_buy gb ON gb.id = gbt.activity_id
     WHERE gbt.id = ?`,
    [teamId],
    tenantId
  );

  if (!team) {
    throw Object.assign(new Error("拼团组不存在"), { statusCode: 404 });
  }

  const members = await queryWithTenant<Record<string, unknown>>(
    `SELECT id, user_id AS userId, order_id AS orderId, is_leader AS isLeader, joined_at AS joinedAt
     FROM group_buy_member WHERE team_id = ?`,
    [teamId],
    tenantId
  );

  return { ...team, members };
}

export async function joinGroupBuyTeam(
  teamId: number,
  userId: number,
  quantity: number,
  tenantId: string
) {
  const now = new Date().toISOString();

  await transaction(async (conn) => {
    const [teamRows] = await conn.execute(
      `SELECT gbt.id, gbt.activity_id, gbt.current_size, gbt.target_size, gbt.status, gbt.expires_at,
              gb.max_group_size, gb.total_stock, gb.sold_count, gb.status AS activityStatus
       FROM group_buy_team gbt
       JOIN group_buy gb ON gb.id = gbt.activity_id AND gb.tenant_id = ?
       WHERE gbt.id = ? AND gbt.tenant_id = ? AND gbt.status = 'PENDING' AND gbt.expires_at > ?
       FOR UPDATE`,
      [tenantId, teamId, tenantId, now]
    ) as unknown as Record<string, unknown>[][];

    const team = (teamRows as unknown as Record<string, unknown>[])[0];
    if (!team) {
      throw Object.assign(new Error("拼团组不存在或已结束"), { statusCode: 404 });
    }

    const [memberRows] = await conn.execute(
      `SELECT id FROM group_buy_member WHERE team_id = ? AND user_id = ? AND tenant_id = ?`,
      [teamId, userId, tenantId]
    ) as unknown as Record<string, unknown>[][];

    if ((memberRows as unknown as Record<string, unknown>[]).length > 0) {
      throw Object.assign(new Error("您已参与该团"), { statusCode: 400 });
    }

    if (Number(team.current_size) >= Number(team.target_size)) {
      throw Object.assign(new Error("该团已满员"), { statusCode: 400 });
    }

    const remaining = Number(team.total_stock) - Number(team.sold_count);
    if (remaining < quantity) {
      throw Object.assign(new Error("拼团库存不足"), { statusCode: 400 });
    }

    await conn.execute(
      `INSERT INTO group_buy_member (team_id, user_id, is_leader, tenant_id) VALUES (?, ?, 0, ?)`,
      [teamId, userId, tenantId]
    );

    const newSize = Number(team.current_size) + 1;
    const isCompleted = newSize >= Number(team.target_size);

    await conn.execute(
      `UPDATE group_buy_team
       SET current_size = ?, status = ?, completed_at = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        newSize,
        isCompleted ? "COMPLETED" : "PENDING",
        isCompleted ? now : null,
        teamId,
        tenantId
      ]
    );

    await conn.execute(
      `UPDATE group_buy SET sold_count = sold_count + ? WHERE id = ? AND tenant_id = ?`,
      [quantity, team.activity_id, tenantId]
    );
  });

  const team = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT gbt.id, gbt.activity_id AS activityId, gbt.leader_id AS leaderId,
            gbt.current_size AS currentSize, gbt.target_size AS targetSize,
            gbt.status, gbt.expires_at AS expiresAt,
            gb.name AS activityName, gb.group_price AS groupPrice
     FROM group_buy_team gbt
     JOIN group_buy gb ON gb.id = gbt.activity_id
     WHERE gbt.id = ?`,
    [teamId],
    tenantId
  );

  return {
    ...team,
    message: team?.status === "COMPLETED" ? "拼团成功" : "参团成功"
  };
}
