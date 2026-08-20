import { queryWithTenant, queryOneWithTenant, executeWithTenant } from "../../shared/db";

/** COUNT(*) AS total 通用返回 */
interface CountTotalRow {
  total: number;
}

/** COUNT(*) AS count 通用返回 */
interface CountCountRow {
  count: number;
}

/** t_notification 列表行（带别名） */
interface NotificationRow {
  id: number | string;
  title: string;
  content: string | null;
  type: string;
  isRead: number | string;
  recipientId: number | string | null;
  tenantId: string;
  createdAt: string | Date;
}

/** t_notification 按类型分组统计行 */
interface NotificationTypeCountRow {
  type: string;
  count: number | string;
}

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

  const records = await queryWithTenant<NotificationRow>(
    `SELECT id, title, content, type, is_read AS isRead,
            recipient_id AS recipientId, tenant_id AS tenantId, created_at AS createdAt
     FROM t_notification
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_notification ${where}`,
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
  const row = await queryOneWithTenant<CountCountRow>(
    `SELECT COUNT(*) AS count FROM t_notification WHERE tenant_id = ? AND is_read = 0`,
    [tenantId],
    tenantId
  );
  return { count: Number(row?.count ?? 0) };
}

export async function getTypeStats(tenantId: string) {
  const rows = await queryWithTenant<NotificationTypeCountRow>(
    `SELECT type, COUNT(*) AS count
     FROM t_notification
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
    // 数据库 type 为大写（ORDER/PAYMENT），统一转小写与 typeMap 对齐
    stats[String(row.type).toLowerCase()] = Number(row.count);
  }

  return Object.entries(typeMap).map(([type, label]) => ({
    type,
    label,
    count: stats[type] ?? 0
  }));
}

export async function markAsRead(tenantId: string, id: number) {
  await executeWithTenant(
    `UPDATE t_notification SET is_read = 1 WHERE id = ? AND tenant_id = ? AND is_read = 0`,
    [id, tenantId],
    tenantId
  );
  return { marked: true };
}

export async function markAllRead(tenantId: string) {
  await executeWithTenant(
    `UPDATE t_notification SET is_read = 1 WHERE tenant_id = ? AND is_read = 0`,
    [tenantId],
    tenantId
  );
  return { marked: true };
}

export async function deleteNotification(tenantId: string, id: number) {
  await executeWithTenant(
    `DELETE FROM t_notification WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  return { deleted: true };
}
