/**
 * 即时零售公告服务
 *
 * 用途：门店端管理即时零售小程序的公告（置顶/时段展示）。
 * 租户隔离：admin 接口使用 queryWithTenant / queryOneWithTenant 自动注入 tenant_id；
 *            update/delete 额外注入 store_id 条件，实现 store_id + tenant_id 双重校验，
 *            防止跨租户/跨门店修改或删除公告。
 * miniapp 公开接口（getActiveAnnouncements）无认证上下文，保持按 store_id 过滤
 *             （公告为公开信息，消费者按门店查看）。
 *
 * 关联任务：R55-01 retail-announcement 跨租户数据泄露修复
 */

import { query, queryWithTenant, queryOneWithTenant } from "../../shared/db";

/** 零售公告行 */
interface RetailAnnouncementRow {
  id: number;
  store_id: number;
  title: string;
  content: string;
  status: number;
  is_top: number;
  start_time: Date | string | null;
  end_time: Date | string | null;
  created_at: Date | string;
}

/** 公告列表行（管理端：JOIN t_store 取门店名） */
interface RetailAnnouncementAdminRow extends RetailAnnouncementRow {
  store_name: string | null;
}

/** COUNT(*) AS cnt 聚合行 */
interface CountCntRow {
  cnt: number;
}

/**
 * 查询门店公告列表（admin）
 *
 * @param storeId 门店ID（来自 req.user.storeId，不信任用户输入）
 * @param tenantId 租户ID（来自 req.tenantId）
 */
export async function listAnnouncements(storeId: number, tenantId: string) {
  return queryWithTenant<RetailAnnouncementRow>(
    "SELECT * FROM t_retail_announcement WHERE store_id = ? ORDER BY is_top DESC, created_at DESC",
    [storeId],
    tenantId
  );
}

/**
 * 创建公告（admin）
 *
 * tenant_id 由 queryWithTenant 自动注入 INSERT 语句，store_id 来自 req.user.storeId。
 *
 * @param data 公告数据（store_id 来自 req.user.storeId，已在 controller 校验）
 * @param tenantId 租户ID
 */
export async function createAnnouncement(
  data: {
    store_id: number;
    title: string;
    content: string;
    is_top?: number;
    start_time?: string | null;
    end_time?: string | null;
  },
  tenantId: string
) {
  const result = await queryWithTenant<{ insertId: number }>(
    "INSERT INTO t_retail_announcement (store_id, title, content, is_top, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?, 1)",
    [data.store_id, data.title, data.content, data.is_top ?? 0, data.start_time ?? null, data.end_time ?? null],
    tenantId
  );
  return { id: (result as unknown as { insertId: number }).insertId };
}

/**
 * 更新公告（admin）
 *
 * WHERE 条件同时校验 id + store_id，tenant_id 由 queryWithTenant 自动注入，
 * 实现 store_id + tenant_id 双重校验。affectedRows=0 表示公告不存在或不属于该门店/租户。
 *
 * @param id 公告ID
 * @param data 更新数据
 * @param storeId 门店ID（来自 req.user.storeId）
 * @param tenantId 租户ID
 */
export async function updateAnnouncement(
  id: number,
  data: {
    store_id?: number;
    title?: string;
    content?: string;
    is_top?: number;
    start_time?: string | null;
    end_time?: string | null;
    status?: number;
  },
  storeId: number,
  tenantId: string
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.store_id !== undefined) { fields.push("store_id = ?"); values.push(data.store_id); }
  if (data.title !== undefined) { fields.push("title = ?"); values.push(data.title); }
  if (data.content !== undefined) { fields.push("content = ?"); values.push(data.content); }
  if (data.is_top !== undefined) { fields.push("is_top = ?"); values.push(data.is_top); }
  if (data.start_time !== undefined) { fields.push("start_time = ?"); values.push(data.start_time); }
  if (data.end_time !== undefined) { fields.push("end_time = ?"); values.push(data.end_time); }
  if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
  if (fields.length === 0) return { id };
  const result = await queryWithTenant<{ affectedRows: number }>(
    `UPDATE t_retail_announcement SET ${fields.join(", ")} WHERE id = ? AND store_id = ?`,
    [...values, id, storeId],
    tenantId
  );
  const affectedRows = Number(
    (result as unknown as { affectedRows?: number }).affectedRows ?? 0
  );
  if (affectedRows === 0) {
    throw Object.assign(new Error("公告不存在或无权限"), { statusCode: 404 });
  }
  return { id };
}

/**
 * 查询公告列表（管理端，分页 + 关键词 + 门店名）
 *
 * 输出字段与 admin-web RetailAnnouncement.vue 契约对齐：
 *   storeId / storeName / isTop / startTime / endTime / status(ENABLED/DISABLED) / createdAt
 */
export async function listAnnouncementsAdmin(params: {
  storeId?: number;
  keyword?: string;
  page: number;
  pageSize: number;
}, tenantId: string) {
  const conditions = ["a.tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (params.storeId) {
    conditions.push("a.store_id = ?");
    values.push(params.storeId);
  }
  if (params.keyword) {
    conditions.push("a.title LIKE ?");
    values.push(`%${params.keyword}%`);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;

  const totalRow = await queryOneWithTenant<CountCntRow>(
    `SELECT COUNT(*) AS cnt FROM t_retail_announcement a ${where}`,
    values,
    tenantId
  );
  const rows = await queryWithTenant<RetailAnnouncementAdminRow>(
    `SELECT a.id, a.store_id, a.title, a.content, a.is_top, a.start_time, a.end_time,
            a.status, a.created_at, s.name AS store_name
     FROM t_retail_announcement a
     LEFT JOIN t_store s ON s.id = a.store_id AND s.tenant_id = a.tenant_id
     ${where}
     ORDER BY a.is_top DESC, a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, params.pageSize, (params.page - 1) * params.pageSize],
    tenantId
  );

  return {
    total: Number(totalRow?.cnt ?? 0),
    page: params.page,
    pageSize: params.pageSize,
    records: rows.map((row) => ({
      id: row.id,
      storeId: row.store_id,
      storeName: row.store_name,
      title: row.title,
      content: row.content,
      isTop: Number(row.is_top) === 1,
      startTime: row.start_time,
      endTime: row.end_time,
      status: Number(row.status) === 1 ? "ENABLED" : "DISABLED",
      createdAt: row.created_at,
    })),
  };
}

/**
 * 删除公告（admin）
 *
 * WHERE 条件同时校验 id + store_id，tenant_id 由 queryWithTenant 自动注入，
 * 实现 store_id + tenant_id 双重校验。affectedRows=0 表示公告不存在或不属于该门店/租户。
 *
 * @param id 公告ID
 * @param storeId 门店ID（来自 req.user.storeId）
 * @param tenantId 租户ID
 */
export async function deleteAnnouncement(id: number, storeId: number, tenantId: string) {
  const result = await queryWithTenant<{ affectedRows: number }>(
    "DELETE FROM t_retail_announcement WHERE id = ? AND store_id = ?",
    [id, storeId],
    tenantId
  );
  const affectedRows = Number(
    (result as unknown as { affectedRows?: number }).affectedRows ?? 0
  );
  if (affectedRows === 0) {
    throw Object.assign(new Error("公告不存在或无权限"), { statusCode: 404 });
  }
}

/**
 * 查询活跃公告（miniapp 公开接口）
 *
 * 公开接口无认证上下文（无 req.tenantId），公告为公开信息，按 store_id 过滤。
 * 消费者通过 storeId 查看指定门店的公告。
 *
 * @param storeId 门店ID（来自 req.query，消费者无登录）
 */
export async function getActiveAnnouncements(storeId: number) {
  return query<RetailAnnouncementRow>(
    "SELECT * FROM t_retail_announcement WHERE store_id = ? AND status = 1 AND (start_time IS NULL OR start_time <= NOW()) AND (end_time IS NULL OR end_time >= NOW()) ORDER BY is_top DESC, created_at DESC",
    [storeId]
  );
}
