import { queryWithTenant, queryOneWithTenant, transaction, connExecute } from "../../shared/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ── 数据库行接口定义 ──

/** 拼团活动行 — t_group_buy SELECT 字段（startGroupBuy FOR UPDATE 查询） */
interface GroupBuyRow extends RowDataPacket {
  id: number;
  name: string;
  group_price: number | string;
  min_group_size: number | string;
  max_group_size: number | string;
  time_limit_hours: number | string;
  total_stock: number | string;
  sold_count: number | string;
  status: string;
  start_time: string | Date;
  end_time: string | Date;
}

/** 拼团组行 — t_group_buy_team SELECT 字段（startGroupBuy 末尾查询） */
interface GroupBuyTeamRow extends RowDataPacket {
  id: number;
  activity_id: number;
  leader_id: number;
  current_size: number | string;
  target_size: number | string;
  status: string;
  expires_at: string | Date;
  created_at: string | Date;
}

/** 拼团组 VO 行 — startGroupBuy 末尾 SELECT 带 AS alias，返回 camelCase 字段 */
interface GroupBuyTeamVORow extends RowDataPacket {
  id: number;
  activityId: number;
  leaderId: number;
  currentSize: number | string;
  targetSize: number | string;
  status: string;
  expiresAt: string | Date;
  createdAt: string | Date;
}

/** 拼团组 + 活动组合行 — joinGroupBuy FOR UPDATE 查询（JOIN t_group_buy） */
interface GroupBuyTeamWithActivityRow extends RowDataPacket {
  id: number;
  activity_id: number;
  current_size: number | string;
  target_size: number | string;
  status: string;
  expires_at: string | Date;
  max_group_size: number | string;
  total_stock: number | string;
  sold_count: number | string;
  activityStatus: string;
}

/** 拼团成员存在性检查行 — t_group_buy_member SELECT id */
interface GroupBuyMemberIdRow extends RowDataPacket {
  id: number;
}

/** 砍价活动行 — t_bargain_activity SELECT 字段（startBargain FOR UPDATE 查询） */
interface BargainActivityRow extends RowDataPacket {
  id: number;
  activity_name: string;
  original_price: number | string;
  min_price: number | string;
  total_stock: number | string;
  sold_count: number | string;
  bargain_times: number | string;
  time_limit_hours: number | string;
  help_min_amount: number | string;
  help_max_amount: number | string;
  status: string;
  start_time: string | Date;
  end_time: string | Date;
}

/** 砍价记录 VO 行 — startBargain 末尾 SELECT 带 AS alias，返回 camelCase 字段 */
interface BargainRecordVORow extends RowDataPacket {
  id: number;
  activityId: number;
  initiatorId: number;
  currentPrice: number | string;
  bargainCount: number | string;
  status: string;
  expiresAt: string | Date;
  createdAt: string | Date;
}

/** 砍价记录 + 活动组合行 — helpBargain FOR UPDATE 查询（JOIN t_bargain_activity） */
interface BargainRecordWithActivityRow extends RowDataPacket {
  id: number;
  activity_id: number;
  initiator_id: number;
  current_price: number | string;
  bargain_count: number | string;
  status: string;
  expires_at: string | Date;
  min_price: number | string;
  bargain_times: number | string;
  help_min_amount: number | string;
  help_max_amount: number | string;
  activityStatus: string;
}

/** 砍价帮助存在性检查行 — t_bargain_help SELECT id */
interface BargainHelpIdRow extends RowDataPacket {
  id: number;
}

/** 秒杀活动行 — t_seckill_product SELECT 字段（buySeckill FOR UPDATE 查询） */
interface SeckillProductRow extends RowDataPacket {
  id: number;
  product_id: number;
  seckill_price: number | string;
  seckill_stock: number | string;
  available_stock: number | string;
  limit_per_user: number | string;
  status: string;
  start_time: string | Date;
  end_time: string | Date;
}

// ==================== 拼团活动 ====================

/** 拼团活动列表 */
export async function listGroupBuyActivities(
  tenantId: string,
  page: number,
  pageSize: number,
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
            created_at AS createdAt
     FROM t_group_buy
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_group_buy ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records,
  };
}

/** 拼团活动详情 */
export async function getGroupBuyActivity(tenantId: string, id: number) {
  const record = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT id, name, product_id AS productId, sku_id AS skuId,
            group_price AS groupPrice, original_price AS originalPrice,
            min_group_size AS minGroupSize, max_group_size AS maxGroupSize,
            time_limit_hours AS timeLimitHours, total_stock AS totalStock,
            sold_count AS soldCount, status,
            start_time AS startTime, end_time AS endTime,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_group_buy
     WHERE id = ?`,
    [id],
    tenantId
  );
  if (!record) {
    throw Object.assign(new Error("拼团活动不存在"), { statusCode: 404 });
  }
  return record;
}

/** 发起拼团 */
export async function startGroupBuy(
  tenantId: string,
  activityId: number,
  userId: number,
  quantity: number = 1
) {
  const now = new Date().toISOString();

  const result = await transaction(async (conn) => {
    const [activityRows] = await connExecute<GroupBuyRow[]>(
      conn,
      `SELECT id, name, group_price, min_group_size, max_group_size, time_limit_hours,
              total_stock, sold_count, status, start_time, end_time
       FROM t_group_buy
       WHERE id = ? AND tenant_id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
       FOR UPDATE`,
      [activityId, tenantId, now, now]
    );

    const activity = activityRows[0];
    if (!activity) {
      throw Object.assign(new Error("拼团活动不存在或已结束"), { statusCode: 404 });
    }

    const remaining = Number(activity.total_stock) - Number(activity.sold_count);
    if (remaining < quantity) {
      throw Object.assign(new Error("拼团库存不足"), { statusCode: 400 });
    }

    const expiresAt = new Date(Date.now() + Number(activity.time_limit_hours) * 3600 * 1000).toISOString();

    const [teamResult] = await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_group_buy_team (activity_id, leader_id, current_size, target_size, status, expires_at, tenant_id)
       VALUES (?, ?, 1, ?, 'PENDING', ?, ?)`,
      [activityId, userId, activity.min_group_size, expiresAt, tenantId]
    );

    const teamId = teamResult.insertId;

    await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_group_buy_member (team_id, user_id, is_leader, tenant_id, quantity)
       VALUES (?, ?, 1, ?, ?)`,
      [teamId, userId, tenantId, quantity]
    );

    await connExecute<ResultSetHeader>(
      conn,
      `UPDATE t_group_buy SET sold_count = sold_count + ? WHERE id = ? AND tenant_id = ?`,
      [quantity, activityId, tenantId]
    );

    const [teamRows] = await connExecute<GroupBuyTeamVORow[]>(
      conn,
      `SELECT id, activity_id AS activityId, leader_id AS leaderId,
              current_size AS currentSize, target_size AS targetSize,
              status, expires_at AS expiresAt, created_at AS createdAt
       FROM t_group_buy_team WHERE id = ? AND tenant_id = ?`,
      [teamId, tenantId]
    );

    return teamRows[0];
  });

  return result;
}

/** 参团 */
export async function joinGroupBuy(
  tenantId: string,
  teamId: number,
  userId: number,
  quantity: number = 1
) {
  const now = new Date().toISOString();

  await transaction(async (conn) => {
    const [teamRows] = await connExecute<GroupBuyTeamWithActivityRow[]>(
      conn,
      `SELECT gbt.id, gbt.activity_id, gbt.current_size, gbt.target_size, gbt.status, gbt.expires_at,
              gb.max_group_size, gb.total_stock, gb.sold_count, gb.status AS activityStatus
       FROM t_group_buy_team gbt
       JOIN t_group_buy gb ON gb.id = gbt.activity_id AND gb.tenant_id = ?
       WHERE gbt.id = ? AND gbt.tenant_id = ? AND gbt.status = 'PENDING' AND gbt.expires_at > ?
       FOR UPDATE`,
      [tenantId, teamId, tenantId, now]
    );

    const team = teamRows[0];
    if (!team) {
      throw Object.assign(new Error("拼团组不存在或已结束"), { statusCode: 404 });
    }

    const [memberRows] = await connExecute<GroupBuyMemberIdRow[]>(
      conn,
      `SELECT id FROM t_group_buy_member WHERE team_id = ? AND user_id = ? AND tenant_id = ?`,
      [teamId, userId, tenantId]
    );

    if (memberRows.length > 0) {
      throw Object.assign(new Error("您已参与该团"), { statusCode: 400 });
    }

    if (Number(team.current_size) >= Number(team.target_size)) {
      throw Object.assign(new Error("该团已满员"), { statusCode: 400 });
    }

    const remaining = Number(team.total_stock) - Number(team.sold_count);
    if (remaining < quantity) {
      throw Object.assign(new Error("拼团库存不足"), { statusCode: 400 });
    }

    await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_group_buy_member (team_id, user_id, is_leader, tenant_id, quantity)
       VALUES (?, ?, 0, ?, ?)`,
      [teamId, userId, tenantId, quantity]
    );

    const newSize = Number(team.current_size) + 1;
    const isCompleted = newSize >= Number(team.target_size);

    await connExecute<ResultSetHeader>(
      conn,
      `UPDATE t_group_buy_team
       SET current_size = ?, status = ?, completed_at = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        newSize,
        isCompleted ? "COMPLETED" : "PENDING",
        isCompleted ? now : null,
        teamId,
        tenantId,
      ]
    );

    await connExecute<ResultSetHeader>(
      conn,
      `UPDATE t_group_buy SET sold_count = sold_count + ? WHERE id = ? AND tenant_id = ?`,
      [quantity, team.activity_id, tenantId]
    );
  });

  const team = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT gbt.id, gbt.activity_id AS activityId, gbt.leader_id AS leaderId,
            gbt.current_size AS currentSize, gbt.target_size AS targetSize,
            gbt.status, gbt.expires_at AS expiresAt,
            gb.name AS activityName, gb.group_price AS groupPrice
     FROM t_group_buy_team gbt
     JOIN t_group_buy gb ON gb.id = gbt.activity_id
     WHERE gbt.id = ?`,
    [teamId],
    tenantId
  );

  return {
    ...team,
    message: team?.status === "COMPLETED" ? "拼团成功" : "参团成功",
  };
}

// ==================== 砍价活动 ====================

/** 砍价活动列表 */
export async function listBargainActivities(
  tenantId: string,
  page: number,
  pageSize: number,
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
    `SELECT id, activity_name AS activityName, activity_desc AS activityDesc,
            product_id AS productId, sku_id AS skuId,
            original_price AS originalPrice, min_price AS minPrice,
            total_stock AS totalStock, sold_count AS soldCount,
            bargain_times AS bargainTimes, time_limit_hours AS timeLimitHours,
            help_min_amount AS helpMinAmount, help_max_amount AS helpMaxAmount,
            start_time AS startTime, end_time AS endTime, status,
            created_at AS createdAt
     FROM t_bargain_activity
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_bargain_activity ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records,
  };
}

/** 砍价活动详情 */
export async function getBargainActivity(tenantId: string, id: number) {
  const record = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT id, activity_name AS activityName, activity_desc AS activityDesc,
            product_id AS productId, sku_id AS skuId,
            original_price AS originalPrice, min_price AS minPrice,
            total_stock AS totalStock, sold_count AS soldCount,
            bargain_times AS bargainTimes, time_limit_hours AS timeLimitHours,
            help_min_amount AS helpMinAmount, help_max_amount AS helpMaxAmount,
            start_time AS startTime, end_time AS endTime, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_bargain_activity
     WHERE id = ?`,
    [id],
    tenantId
  );
  if (!record) {
    throw Object.assign(new Error("砍价活动不存在"), { statusCode: 404 });
  }
  return record;
}

/** 发起砍价 */
export async function startBargain(
  tenantId: string,
  activityId: number,
  userId: number
) {
  const now = new Date().toISOString();

  const result = await transaction(async (conn) => {
    const [activityRows] = await connExecute<BargainActivityRow[]>(
      conn,
      `SELECT id, activity_name, original_price, min_price, total_stock, sold_count,
              bargain_times, time_limit_hours, help_min_amount, help_max_amount,
              status, start_time, end_time
       FROM t_bargain_activity
       WHERE id = ? AND tenant_id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
       FOR UPDATE`,
      [activityId, tenantId, now, now]
    );

    const activity = activityRows[0];
    if (!activity) {
      throw Object.assign(new Error("砍价活动不存在或已结束"), { statusCode: 404 });
    }

    const remaining = Number(activity.total_stock) - Number(activity.sold_count);
    if (remaining <= 0) {
      throw Object.assign(new Error("砍价活动库存不足"), { statusCode: 400 });
    }

    const expiresAt = new Date(Date.now() + Number(activity.time_limit_hours) * 3600 * 1000).toISOString();

    const [recordResult] = await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_bargain_record (activity_id, initiator_id, current_price, bargain_count, status, expires_at, tenant_id)
       VALUES (?, ?, ?, 0, 'ONGOING', ?, ?)`,
      [activityId, userId, activity.original_price, expiresAt, tenantId]
    );

    const recordId = recordResult.insertId;

    const [recordRows] = await connExecute<BargainRecordVORow[]>(
      conn,
      `SELECT id, activity_id AS activityId, initiator_id AS initiatorId,
              current_price AS currentPrice, bargain_count AS bargainCount,
              status, expires_at AS expiresAt, created_at AS createdAt
       FROM t_bargain_record WHERE id = ? AND tenant_id = ?`,
      [recordId, tenantId]
    );

    return recordRows[0];
  });

  return result;
}

/** 帮砍 */
export async function helpBargain(
  tenantId: string,
  recordId: number,
  helperId: number,
  helperName?: string
) {
  const now = new Date().toISOString();

  const result = await transaction(async (conn) => {
    const [recordRows] = await connExecute<BargainRecordWithActivityRow[]>(
      conn,
      `SELECT br.id, br.activity_id, br.initiator_id, br.current_price, br.bargain_count, br.status, br.expires_at,
              ba.min_price, ba.bargain_times, ba.help_min_amount, ba.help_max_amount, ba.status AS activityStatus
       FROM t_bargain_record br
       JOIN t_bargain_activity ba ON ba.id = br.activity_id AND ba.tenant_id = ?
       WHERE br.id = ? AND br.tenant_id = ? AND br.status = 'ONGOING' AND br.expires_at > ?
       FOR UPDATE`,
      [tenantId, recordId, tenantId, now]
    );

    const record = recordRows[0];
    if (!record) {
      throw Object.assign(new Error("砍价记录不存在或已结束"), { statusCode: 404 });
    }

    if (Number(record.initiator_id) === helperId) {
      throw Object.assign(new Error("不能给自己砍价"), { statusCode: 400 });
    }

    const [helpRows] = await connExecute<BargainHelpIdRow[]>(
      conn,
      `SELECT id FROM t_bargain_help WHERE record_id = ? AND helper_id = ? AND tenant_id = ?`,
      [recordId, helperId, tenantId]
    );
    if (helpRows.length > 0) {
      throw Object.assign(new Error("您已帮砍过"), { statusCode: 400 });
    }

    if (Number(record.bargain_count) >= Number(record.bargain_times)) {
      throw Object.assign(new Error("已达到最大砍价次数"), { statusCode: 400 });
    }

    const minAmt = Number(record.help_min_amount);
    const maxAmt = Number(record.help_max_amount);
    const randomAmount = Math.round((Math.random() * (maxAmt - minAmt) + minAmt) * 100) / 100;

    const currentPrice = Number(record.current_price);
    const minPrice = Number(record.min_price);
    const actualAmount = Math.min(randomAmount, currentPrice - minPrice);
    const newPrice = Math.max(currentPrice - actualAmount, minPrice);
    const newCount = Number(record.bargain_count) + 1;
    const isSuccess = newPrice <= minPrice || newCount >= Number(record.bargain_times);

    await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_bargain_help (record_id, helper_id, helper_name, bargain_amount, tenant_id)
       VALUES (?, ?, ?, ?, ?)`,
      [recordId, helperId, helperName || null, actualAmount, tenantId]
    );

    await connExecute<ResultSetHeader>(
      conn,
      `UPDATE t_bargain_record
       SET current_price = ?, bargain_count = ?, status = ?, success_at = ?, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [
        newPrice,
        newCount,
        isSuccess ? "SUCCESS" : "ONGOING",
        isSuccess ? now : null,
        recordId,
        tenantId,
      ]
    );

    return {
      recordId,
      bargainAmount: actualAmount,
      currentPrice: newPrice,
      bargainCount: newCount,
      status: isSuccess ? "SUCCESS" : "ONGOING",
      isSuccess,
    };
  });

  return result;
}

// ==================== 秒杀活动 ====================

/** 秒杀活动列表 */
export async function listSeckillActivities(
  tenantId: string,
  page: number,
  pageSize: number,
  status?: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    conditions.push("sp.status = ?");
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<Record<string, unknown>>(
    `SELECT sp.id, sp.product_id AS productId, sp.seckill_price AS seckillPrice,
            sp.original_price AS originalPrice, sp.seckill_stock AS seckillStock,
            sp.available_stock AS availableStock, sp.limit_per_user AS limitPerUser,
            sp.start_time AS startTime, sp.end_time AS endTime, sp.status,
            p.name AS productName
     FROM t_seckill_product sp
     LEFT JOIN t_product_spu p ON p.id = sp.product_id
     ${where}
     ORDER BY sp.start_time ASC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_seckill_product sp ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records,
  };
}

/** 秒杀活动详情 */
export async function getSeckillActivity(tenantId: string, id: number) {
  const record = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT sp.id, sp.product_id AS productId, sp.seckill_price AS seckillPrice,
            sp.original_price AS originalPrice, sp.seckill_stock AS seckillStock,
            sp.available_stock AS availableStock, sp.limit_per_user AS limitPerUser,
            sp.start_time AS startTime, sp.end_time AS endTime, sp.status,
            p.name AS productName
     FROM t_seckill_product sp
     LEFT JOIN t_product_spu p ON p.id = sp.product_id
     WHERE sp.id = ?`,
    [id],
    tenantId
  );
  if (!record) {
    throw Object.assign(new Error("秒杀活动不存在"), { statusCode: 404 });
  }
  return record;
}

/** 秒杀下单 */
export async function buySeckill(
  tenantId: string,
  activityId: number,
  userId: number,
  quantity: number = 1
) {
  const now = new Date().toISOString();

  const result = await transaction(async (conn) => {
    const [activityRows] = await connExecute<SeckillProductRow[]>(
      conn,
      `SELECT id, product_id, seckill_price, seckill_stock, available_stock, limit_per_user,
              status, start_time, end_time
       FROM t_seckill_product
       WHERE id = ? AND tenant_id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
       FOR UPDATE`,
      [activityId, tenantId, now, now]
    );

    const activity = activityRows[0];
    if (!activity) {
      throw Object.assign(new Error("秒杀活动不存在或已结束"), { statusCode: 404 });
    }

    const availableStock = Number(activity.available_stock);
    if (availableStock < quantity) {
      throw Object.assign(new Error("秒杀库存不足"), { statusCode: 400 });
    }

    const limitPerUser = Number(activity.limit_per_user) || 1;
    if (quantity > limitPerUser) {
      throw Object.assign(new Error(`每人限购${limitPerUser}件`), { statusCode: 400 });
    }

    await connExecute<ResultSetHeader>(
      conn,
      `UPDATE t_seckill_product SET available_stock = available_stock - ? WHERE id = ? AND tenant_id = ?`,
      [quantity, activityId, tenantId]
    );

    const orderNo = `SK${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;

    return {
      orderNo,
      productId: activity.product_id,
      seckillPrice: activity.seckill_price,
      quantity,
      totalAmount: Number(activity.seckill_price) * quantity,
    };
  });

  return result;
}

// ==================== 结束活动（管理端） ====================

/** 结束拼团活动（仅 ACTIVE 可结束，状态置 ENDED） */
export async function endGroupBuyActivity(tenantId: string, id: number) {
  const existing = await queryOneWithTenant<{ id: number | string; status: string }>(
    "SELECT id, status FROM t_group_buy WHERE id = ?",
    [id],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("拼团活动不存在"), { statusCode: 404 });
  }
  if (existing.status !== "ACTIVE") {
    throw Object.assign(new Error("仅进行中的活动可结束"), { statusCode: 400 });
  }
  await queryWithTenant(
    "UPDATE t_group_buy SET status = 'ENDED', updated_at = NOW() WHERE id = ?",
    [id],
    tenantId
  );
  return { id, status: "ENDED" };
}

/** 结束砍价活动（仅 ACTIVE 可结束，状态置 ENDED） */
export async function endBargainActivity(tenantId: string, id: number) {
  const existing = await queryOneWithTenant<{ id: number | string; status: string }>(
    "SELECT id, status FROM t_bargain_activity WHERE id = ?",
    [id],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("砍价活动不存在"), { statusCode: 404 });
  }
  if (existing.status !== "ACTIVE") {
    throw Object.assign(new Error("仅进行中的活动可结束"), { statusCode: 400 });
  }
  await queryWithTenant(
    "UPDATE t_bargain_activity SET status = 'ENDED', updated_at = NOW() WHERE id = ?",
    [id],
    tenantId
  );
  return { id, status: "ENDED" };
}

/** 结束秒杀活动（仅 ACTIVE 可结束，状态置 ENDED） */
export async function endSeckillActivity(tenantId: string, id: number) {
  const existing = await queryOneWithTenant<{ id: number | string; status: string }>(
    "SELECT id, status FROM t_seckill_product WHERE id = ?",
    [id],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("秒杀活动不存在"), { statusCode: 404 });
  }
  if (existing.status !== "ACTIVE") {
    throw Object.assign(new Error("仅进行中的活动可结束"), { statusCode: 400 });
  }
  await queryWithTenant(
    "UPDATE t_seckill_product SET status = 'ENDED', updated_at = NOW() WHERE id = ?",
    [id],
    tenantId
  );
  return { id, status: "ENDED" };
}

// ==================== 参与记录（管理端，分页） ====================

/** 拼团参与记录行 — t_group_buy_member JOIN 活动/组/会员 */
interface GroupBuyParticipationRow extends RowDataPacket {
  id: number | string;
  activityId: number | string;
  activityName: string;
  memberId: number | string | null;
  memberName: string | null;
  memberMobile: string | null;
  quantity: number | string;
  teamStatus: string;
  participationTime: string | Date;
}

/** 拼团参与记录（分页） */
export async function listGroupBuyParticipationRecords(
  tenantId: string,
  activityId: number,
  page: number,
  pageSize: number
) {
  const activity = await queryOneWithTenant<{ id: number | string }>(
    "SELECT id FROM t_group_buy WHERE id = ?",
    [activityId],
    tenantId
  );
  if (!activity) {
    throw Object.assign(new Error("拼团活动不存在"), { statusCode: 404 });
  }

  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<GroupBuyParticipationRow>(
    `SELECT gm.id, gb.id AS activityId, gb.name AS activityName,
            gm.user_id AS memberId, m.name AS memberName, m.mobile AS memberMobile,
            gm.quantity, gt.status AS teamStatus, gm.joined_at AS participationTime
     FROM t_group_buy_member gm
     JOIN t_group_buy_team gt ON gt.id = gm.team_id AND gt.tenant_id = ?
     JOIN t_group_buy gb ON gb.id = gt.activity_id AND gb.tenant_id = ?
     LEFT JOIN t_member m ON m.id = gm.user_id AND m.tenant_id = ?
     WHERE gb.id = ? AND gm.tenant_id = ?
     ORDER BY gm.joined_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, tenantId, tenantId, activityId, tenantId, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<{ total: number | string }>(
    `SELECT COUNT(*) AS total
     FROM t_group_buy_member gm
     JOIN t_group_buy_team gt ON gt.id = gm.team_id AND gt.tenant_id = ?
     JOIN t_group_buy gb ON gb.id = gt.activity_id AND gb.tenant_id = ?
     WHERE gb.id = ? AND gm.tenant_id = ?`,
    [tenantId, tenantId, activityId, tenantId],
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records,
  };
}

/** 砍价参与记录行 — t_bargain_record JOIN 活动/会员 */
interface BargainParticipationRow extends RowDataPacket {
  id: number | string;
  activityId: number | string;
  activityName: string;
  memberId: number | string | null;
  memberName: string | null;
  memberMobile: string | null;
  currentPrice: number | string;
  status: string;
  participationTime: string | Date;
}

/** 砍价参与记录（分页） */
export async function listBargainParticipationRecords(
  tenantId: string,
  activityId: number,
  page: number,
  pageSize: number
) {
  const activity = await queryOneWithTenant<{ id: number | string }>(
    "SELECT id FROM t_bargain_activity WHERE id = ?",
    [activityId],
    tenantId
  );
  if (!activity) {
    throw Object.assign(new Error("砍价活动不存在"), { statusCode: 404 });
  }

  const offset = (page - 1) * pageSize;
  const records = await queryWithTenant<BargainParticipationRow>(
    `SELECT br.id, ba.id AS activityId, ba.activity_name AS activityName,
            br.initiator_id AS memberId, m.name AS memberName, m.mobile AS memberMobile,
            br.current_price AS currentPrice, br.status,
            br.created_at AS participationTime
     FROM t_bargain_record br
     JOIN t_bargain_activity ba ON ba.id = br.activity_id AND ba.tenant_id = ?
     LEFT JOIN t_member m ON m.id = br.initiator_id AND m.tenant_id = ?
     WHERE ba.id = ? AND br.tenant_id = ?
     ORDER BY br.created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, tenantId, activityId, tenantId, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<{ total: number | string }>(
    `SELECT COUNT(*) AS total
     FROM t_bargain_record br
     JOIN t_bargain_activity ba ON ba.id = br.activity_id AND ba.tenant_id = ?
     WHERE ba.id = ? AND br.tenant_id = ?`,
    [tenantId, activityId, tenantId],
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records,
  };
}

/**
 * 秒杀参与记录（分页）
 *
 * 说明：社区营销秒杀（t_seckill_product）下单 buySeckill 仅扣减库存并返回订单号，
 * 未落任何参与/订单记录表，系统内无秒杀参与数据源。为满足「参与记录」接口契约，
 * 返回空分页（不编造数据），待秒杀订单落库能力建设后可在此补充真实查询。
 */
export async function listSeckillParticipationRecords(
  tenantId: string,
  activityId: number,
  page: number,
  pageSize: number
) {
  const activity = await queryOneWithTenant<{ id: number | string }>(
    "SELECT id FROM t_seckill_product WHERE id = ?",
    [activityId],
    tenantId
  );
  if (!activity) {
    throw Object.assign(new Error("秒杀活动不存在"), { statusCode: 404 });
  }

  return {
    total: 0,
    page,
    pageSize,
    records: [],
  };
}
