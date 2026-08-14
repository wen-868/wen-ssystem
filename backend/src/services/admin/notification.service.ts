import { query, queryOne, queryWithTenant, pool } from "../../shared/db";

// ==================== 类型定义 ====================

/** 通知行 */
interface NotificationRow {
  id: number;
  recipientId: number;
  recipientType: string;
  title: string;
  content: string;
  type: string;
  relatedId: number | null;
  relatedType: string | null;
  isRead: number;
  sentAt: string | Date;
  readAt: string | Date | null;
  createdAt: string | Date;
}

/** 小程序通知行（字段更少） */
interface NotificationMiniRow {
  id: number;
  title: string;
  content: string;
  type: string;
  relatedId: number | null;
  relatedType: string | null;
  isRead: number;
  sentAt: string | Date;
  readAt: string | Date | null;
}

/** 计数 total 行 */
interface CountTotalRow {
  total: number;
}

/** 计数 count 行 */
interface CountCountRow {
  count: number;
}

export interface SendNotificationParams {
  recipientId: number;
  recipientType: "ADMIN" | "MERCHANT" | "CONSUMER";
  title: string;
  content: string;
  type: "SYSTEM" | "ORDER" | "PAYMENT" | "ALERT" | "CREDIT" | "RECALL";
  relatedId?: number | null;
  relatedType?: string | null;
  tenantId: string;
}

export async function sendNotification(
  params: SendNotificationParams
): Promise<number> {
  const [result] = await pool.query(
    `INSERT INTO t_notification (recipient_id, recipient_type, title, content, type, related_id, related_type, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.recipientId,
      params.recipientType,
      params.title,
      params.content,
      params.type,
      params.relatedId ?? null,
      params.relatedType ?? null,
      params.tenantId
    ]
  );
  return (result as unknown as { insertId: number }).insertId;
}

// ========== 工作台通知 ==========

export async function listNotifications(
  tenantId: string, filters: { type?: string; isRead?: number },
  page: number, pageSize: number
) {
  const conditions: string[] = ["n.tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (filters.type) {
    conditions.push("n.type = ?");
    params.push(filters.type);
  }
  if (filters.isRead !== undefined) {
    conditions.push("n.is_read = ?");
    params.push(filters.isRead);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const offset = (page - 1) * pageSize;

  const records = await query<NotificationRow>(
    `SELECT n.id, n.recipient_id AS recipientId, n.recipient_type AS recipientType,
            n.title, n.content, n.type,
            n.related_id AS relatedId, n.related_type AS relatedType,
            n.is_read AS isRead, n.sent_at AS sentAt, n.read_at AS readAt,
            n.created_at AS createdAt
     FROM t_notification n
     ${where}
     ORDER BY n.sent_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_notification n ${where}`,
    params
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function getUnreadCount(tenantId: string, userId: number) {
  const count = await queryOne<CountCountRow>(
    `SELECT COUNT(*) AS count FROM t_notification WHERE recipient_id = ? AND recipient_type = 'ADMIN' AND is_read = 0 AND tenant_id = ?`,
    [userId, tenantId]
  );
  return { count: Number(count?.count ?? 0) };
}

export async function markAsRead(tenantId: string, id: number) {
  await query(
    `UPDATE t_notification SET is_read = 1, read_at = NOW() WHERE id = ? AND tenant_id = ? AND is_read = 0`,
    [id, tenantId]
  );
  return { marked: true };
}

export async function markAllRead(tenantId: string, userId: number) {
  await query(
    `UPDATE t_notification SET is_read = 1, read_at = NOW()
     WHERE recipient_id = ? AND recipient_type = 'ADMIN' AND is_read = 0 AND tenant_id = ?`,
    [userId, tenantId]
  );
  return { marked: true };
}

// ========== 通知详情 / 删除（工作台） ==========

/** 单条通知详情 */
export async function getNotificationById(tenantId: string, id: number) {
  const row = await queryOne<NotificationRow>(
    `SELECT id, recipient_id AS recipientId, recipient_type AS recipientType,
            title, content, type,
            related_id AS relatedId, related_type AS relatedType,
            is_read AS isRead, sent_at AS sentAt, read_at AS readAt,
            created_at AS createdAt
     FROM t_notification
     WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  return row ?? null;
}

/** 删除单条通知 */
export async function deleteNotification(tenantId: string, id: number) {
  const [result] = await queryWithTenant(
    "DELETE FROM t_notification WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  const affected = (result as unknown as { affectedRows: number }).affectedRows ?? 0;
  return { deleted: affected > 0 };
}

/** 批量删除通知 */
export async function batchDeleteNotifications(tenantId: string, ids: number[]) {
  if (ids.length === 0) {
    return { deleted: 0 };
  }
  const placeholders = ids.map(() => "?").join(", ");
  const [result] = await queryWithTenant(
    `DELETE FROM t_notification WHERE id IN (${placeholders}) AND tenant_id = ?`,
    [...ids, tenantId],
    tenantId
  );
  const affected = (result as unknown as { affectedRows: number }).affectedRows ?? 0;
  return { deleted: affected };
}

// ========== 小程序通知 ==========

export async function listMyNotifications(
  tenantId: string, userId: number, page: number, pageSize: number
) {
  const offset = (page - 1) * pageSize;

  const records = await query<NotificationMiniRow>(
    `SELECT id, title, content, type,
            related_id AS relatedId, related_type AS relatedType,
            is_read AS isRead, sent_at AS sentAt, read_at AS readAt
     FROM t_notification
     WHERE recipient_id = ? AND recipient_type = 'CONSUMER' AND tenant_id = ?
     ORDER BY sent_at DESC
     LIMIT ? OFFSET ?`,
    [userId, tenantId, pageSize, offset]
  );

  const totalRow = await queryOne<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_notification WHERE recipient_id = ? AND recipient_type = 'CONSUMER' AND tenant_id = ?`,
    [userId, tenantId]
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function getMyUnreadCount(tenantId: string, userId: number) {
  const count = await queryOne<CountCountRow>(
    `SELECT COUNT(*) AS count FROM t_notification WHERE recipient_id = ? AND recipient_type = 'CONSUMER' AND is_read = 0 AND tenant_id = ?`,
    [userId, tenantId]
  );
  return { count: Number(count?.count ?? 0) };
}

export async function markMyRead(tenantId: string, id: number) {
  await query(
    `UPDATE t_notification SET is_read = 1, read_at = NOW() WHERE id = ? AND tenant_id = ? AND is_read = 0`,
    [id, tenantId]
  );
  return { marked: true };
}

export async function markMyAllRead(tenantId: string, userId: number) {
  await query(
    `UPDATE t_notification SET is_read = 1, read_at = NOW()
     WHERE recipient_id = ? AND recipient_type = 'CONSUMER' AND is_read = 0 AND tenant_id = ?`,
    [userId, tenantId]
  );
  return { marked: true };
}
