import { query, queryOne, pool } from "../../shared/db";

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

// ========== 管理后台通知 ==========

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

  const records = await query<any>(
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

  const totalRow = await queryOne<any>(
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
  const count = await queryOne<any>(
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

// ========== 小程序通知 ==========

export async function listMyNotifications(
  tenantId: string, userId: number, page: number, pageSize: number
) {
  const offset = (page - 1) * pageSize;

  const records = await query<any>(
    `SELECT id, title, content, type,
            related_id AS relatedId, related_type AS relatedType,
            is_read AS isRead, sent_at AS sentAt, read_at AS readAt
     FROM t_notification
     WHERE recipient_id = ? AND recipient_type = 'CONSUMER' AND tenant_id = ?
     ORDER BY sent_at DESC
     LIMIT ? OFFSET ?`,
    [userId, tenantId, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
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
  const count = await queryOne<any>(
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