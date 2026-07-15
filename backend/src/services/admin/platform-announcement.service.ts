import { query, queryOne } from "../../shared/db";

export interface AnnouncementListParams {
  page: number;
  pageSize: number;
  type?: string;
  status?: number;
  keyword?: string;
}

export interface AnnouncementItem {
  id: number;
  title: string;
  type: string;
  content: string;
  isTop: number;
  status: number;
  publishAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementCreate {
  title: string;
  type: string;
  content: string;
  isTop: number;
  status: number;
}

export async function listAnnouncements(params: AnnouncementListParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["1=1"];
  const sqlParams: unknown[] = [];

  if (params.type) {
    conditions.push("type = ?");
    sqlParams.push(params.type);
  }
  if (params.status !== undefined) {
    conditions.push("status = ?");
    sqlParams.push(params.status);
  }
  if (params.keyword) {
    conditions.push("(title LIKE ? OR content LIKE ?)");
    const like = `%${params.keyword}%`;
    sqlParams.push(like, like);
  }

  const where = conditions.join(" AND ");

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM platform_announcement WHERE ${where}`,
    sqlParams
  );
  const total = Number(totalRow?.total ?? 0);

  const records = await query<AnnouncementItem[]>(
    `SELECT id, title, type, content, is_top AS isTop, status,
            publish_at AS publishAt, created_by AS createdBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM platform_announcement
     WHERE ${where}
     ORDER BY is_top DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset]
  );

  return { total, page: params.page, pageSize: params.pageSize, records };
}

export async function getAnnouncementById(id: number) {
  return queryOne<AnnouncementItem>(
    `SELECT id, title, type, content, is_top AS isTop, status,
            publish_at AS publishAt, created_by AS createdBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM platform_announcement WHERE id = ?`,
    [id]
  );
}

export async function createAnnouncement(data: AnnouncementCreate) {
  const result = await query(
    `INSERT INTO platform_announcement (title, type, content, is_top, status, created_by)
     VALUES (?, ?, ?, ?, ?, 'system')`,
    [data.title, data.type, data.content, data.isTop, data.status]
  );
  const insertId = (result as any).insertId;
  return { id: insertId };
}

export async function updateAnnouncement(id: number, data: Partial<AnnouncementCreate>) {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.title !== undefined) { fields.push("title = ?"); values.push(data.title); }
  if (data.type !== undefined) { fields.push("type = ?"); values.push(data.type); }
  if (data.content !== undefined) { fields.push("content = ?"); values.push(data.content); }
  if (data.isTop !== undefined) { fields.push("is_top = ?"); values.push(data.isTop); }
  if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }

  fields.push("updated_at = NOW()");
  values.push(id);

  await query(
    `UPDATE platform_announcement SET ${fields.join(", ")} WHERE id = ?`,
    values
  );
  return { id };
}

export async function deleteAnnouncement(id: number) {
  await query("DELETE FROM platform_announcement WHERE id = ?", [id]);
  return { success: true };
}

export async function togglePublish(id: number) {
  const announcement = await queryOne<{ status: number }>(
    "SELECT status FROM platform_announcement WHERE id = ?",
    [id]
  );
  if (!announcement) {
    throw new Error("公告不存在");
  }

  const newStatus = announcement.status === 1 ? 0 : 1;
  const publishAt = newStatus === 1 ? "publish_at = NOW()," : "";

  await query(
    `UPDATE platform_announcement SET ${publishAt} status = ?, updated_at = NOW() WHERE id = ?`,
    [newStatus, id]
  );

  return { id, status: newStatus };
}
