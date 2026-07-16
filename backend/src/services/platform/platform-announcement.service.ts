/**
 * 平台总后台 - 公告服务
 *
 * 功能：平台公告管理（区别于即时零售公告 retail_announcement）
 */
import { query, queryOne } from "../../shared/db";

export interface PlatformAnnouncement {
  id: number;
  title: string;
  content: string;
  type: string;
  status: string;
  topFlag: number;
  publishAt?: Date;
  offlineAt?: Date;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 公告列表
 */
export async function listAnnouncements(params: {
  status?: string;
  type?: string;
  page: number;
  pageSize: number;
}) {
  const { status, type, page, pageSize } = params;
  const conditions: string[] = ["1=1"];
  const queryParams: unknown[] = [];

  if (status) {
    conditions.push("status = ?");
    queryParams.push(status);
  }
  if (type) {
    conditions.push("type = ?");
    queryParams.push(type);
  }

  const where = conditions.join(" AND ");
  const offset = (page - 1) * pageSize;

  const records = await query<PlatformAnnouncement>(
    `SELECT id, title, content, type, status, top_flag AS topFlag,
            publish_at AS publishAt, offline_at AS offlineAt,
            created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
     FROM t_platform_announcement
     WHERE ${where}
     ORDER BY top_flag DESC, publish_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  );

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_platform_announcement WHERE ${where}`,
    queryParams
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

/**
 * 创建公告
 */
export async function createAnnouncement(body: {
  title: string;
  content: string;
  type: string;
  topFlag?: number;
  createdBy?: number;
}) {
  const result = await query(
    `INSERT INTO t_platform_announcement (title, content, type, status, top_flag, publish_at, created_by)
     VALUES (?, ?, ?, 'PUBLISHED', ?, NOW(), ?)`,
    [
      body.title,
      body.content,
      body.type,
      body.topFlag ?? 0,
      body.createdBy ?? null
    ]
  );

  const insertId = (result as unknown as { insertId: number }).insertId;

  const record = await queryOne<PlatformAnnouncement>(
    `SELECT id, title, content, type, status, top_flag AS topFlag,
            publish_at AS publishAt, created_by AS createdBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_platform_announcement WHERE id = ?`,
    [insertId]
  );

  return record;
}
