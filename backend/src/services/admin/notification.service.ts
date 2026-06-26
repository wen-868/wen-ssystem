import { query, queryOne } from "../../shared/db.js";

export async function listNotifications(params: {
  page: number;
  pageSize: number;
  tenantId: string;
  type?: string;
  isRead?: number;
}) {
  const { page, pageSize, tenantId, type, isRead } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["n.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (type) {
    conditions.push("n.type = ?");
    queryParams.push(type);
  }
  if (isRead !== undefined) {
    conditions.push("n.is_read = ?");
    queryParams.push(isRead);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const records = await query<any>(
    `SELECT n.id, n.recipient_id AS recipientId, n.recipient_type AS recipientType,
            n.title, n.content, n.type,
            n.related_id AS relatedId, n.related_type AS relatedType,
            n.is_read AS isRead, n.sent_at AS sentAt, n.read_at AS readAt,
            n.created_at AS createdAt
     FROM notification n
     ${where}
     ORDER BY n.sent_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM notification n ${where}`,
    queryParams
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records,
  };
}

export async function getUnreadCount(recipientId: number, recipientType: string, tenantId: string) {
  const count = await queryOne<any>(
    `SELECT COUNT(*) AS count FROM notification WHERE recipient_id = ? AND recipient_type = ? AND is_read = 0 AND tenant_id = ?`,
    [recipientId, recipientType, tenantId]
  );
  return { count: Number(count?.count ?? 0) };
}

export async function markAsRead(id: number, tenantId: string) {
  await query(
    `UPDATE notification SET is_read = 1, read_at = NOW() WHERE id = ? AND tenant_id = ? AND is_read = 0`,
    [id, tenantId]
  );
  return { marked: true };
}

export async function markAllAsRead(recipientId: number, recipientType: string, tenantId: string) {
  await query(
    `UPDATE notification SET is_read = 1, read_at = NOW()
     WHERE recipient_id = ? AND recipient_type = ? AND is_read = 0 AND tenant_id = ?`,
    [recipientId, recipientType, tenantId]
  );
  return { marked: true };
}

export async function sendNotification(params: {
  recipientId: number;
  recipientType: string;
  title: string;
  content: string;
  type: string;
  relatedId?: number | null;
  relatedType?: string | null;
  tenantId: string;
}) {
  const result = await query<{ insertId: number }>(
    `INSERT INTO notification (recipient_id, recipient_type, title, content, type, related_id, related_type, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.recipientId,
      params.recipientType,
      params.title,
      params.content,
      params.type,
      params.relatedId ?? null,
      params.relatedType ?? null,
      params.tenantId,
    ]
  );
  return { id: (result as any).insertId, sent: true };
}

export async function listMiniappNotifications(params: {
  page: number;
  pageSize: number;
  recipientId: number;
  tenantId: string;
}) {
  const { page, pageSize, recipientId, tenantId } = params;
  const offset = (page - 1) * pageSize;

  const records = await query<any>(
    `SELECT id, title, content, type,
            related_id AS relatedId, related_type AS relatedType,
            is_read AS isRead, sent_at AS sentAt, read_at AS readAt
     FROM notification
     WHERE recipient_id = ? AND recipient_type = 'CONSUMER' AND tenant_id = ?
     ORDER BY sent_at DESC
     LIMIT ? OFFSET ?`,
    [recipientId, tenantId, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM notification WHERE recipient_id = ? AND recipient_type = 'CONSUMER' AND tenant_id = ?`,
    [recipientId, tenantId]
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records,
  };
}

export async function getMiniappUnreadCount(recipientId: number, tenantId: string) {
  const count = await queryOne<any>(
    `SELECT COUNT(*) AS count FROM notification WHERE recipient_id = ? AND recipient_type = 'CONSUMER' AND is_read = 0 AND tenant_id = ?`,
    [recipientId, tenantId]
  );
  return { count: Number(count?.count ?? 0) };
}