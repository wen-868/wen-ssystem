import { queryWithTenant, queryOneWithTenant, executeWithTenant } from "../../shared/db.js";

export async function listNotifications(
  tenantId: string,
  page: number,
  pageSize: number,
  type?: string,
  isRead?: number
) {
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }
  if (isRead !== undefined) {
    conditions.push("is_read = ?");
    params.push(isRead);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const offset = (page - 1) * pageSize;

  const records = await queryWithTenant<any>(
    `SELECT id, title, content, type, is_read AS isRead,
            recipient_id AS recipientId, tenant_id AS tenantId, created_at AS createdAt
     FROM notifications
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM notifications ${where}`,
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

export async function getUnreadCount(tenantId: string) {
  const row = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS count FROM notifications WHERE tenant_id = ? AND is_read = 0`,
    [tenantId],
    tenantId
  );
  return { count: Number(row?.count ?? 0) };
}

export async function getTypeStats(tenantId: string) {
  const rows = await queryWithTenant<any>(
    `SELECT type, COUNT(*) AS count
     FROM notifications
     WHERE tenant_id = ? AND is_read = 0
     GROUP BY type`,
    [tenantId],
    tenantId
  );

  const typeMap: Record<string, string> = {
    system: "系统通知",
    order: "订单消息",
    payment: "支付消息",
    alert: "预警通知",
    credit: "信用消息",
    recall: "召回消息"
  };

  const stats: Record<string, number> = {};
  for (const key of Object.keys(typeMap)) {
    stats[key] = 0;
  }
  for (const row of rows) {
    stats[row.type] = Number(row.count);
  }

  return Object.entries(typeMap).map(([type, label]) => ({
    type,
    label,
    count: stats[type] ?? 0
  }));
}

export async function markAsRead(tenantId: string, id: number) {
  await executeWithTenant(
    `UPDATE notifications SET is_read = 1 WHERE id = ? AND tenant_id = ? AND is_read = 0`,
    [id, tenantId],
    tenantId
  );
  return { marked: true };
}

export async function markAllRead(tenantId: string) {
  await executeWithTenant(
    `UPDATE notifications SET is_read = 1 WHERE tenant_id = ? AND is_read = 0`,
    [tenantId],
    tenantId
  );
  return { marked: true };
}

export async function deleteNotification(tenantId: string, id: number) {
  await executeWithTenant(
    `DELETE FROM notifications WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  return { deleted: true };
}