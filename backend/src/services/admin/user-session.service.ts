import { query, queryOne } from "../../shared/db.js";

export async function getUserSessions(tenantId: string, params?: { userId?: number; page?: number; pageSize?: number }) {
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  let where = "WHERE 1=1";
  const vals: any[] = [];
  if (params?.userId) { where += " AND user_id = ?"; vals.push(params.userId); }
  const [rows, total] = await Promise.all([
    query<any>(`SELECT us.*, su.username, su.real_name AS realName FROM user_session us LEFT JOIN t_sys_user su ON us.user_id = su.id ${where} ORDER BY us.last_activity_at DESC LIMIT ${offset}, ${pageSize}`, vals),
    queryOne<any>(`SELECT COUNT(*) AS cnt FROM user_session ${where}`, vals)
  ]);
  return { records: rows, total: total?.cnt || 0, page, pageSize };
}

export async function revokeSession(sessionId: number) {
  await query(`DELETE FROM user_session WHERE id=?`, [sessionId]);
  return { success: true };
}

export async function getOnlineStats() {
  const result = await queryOne<any>(`SELECT COUNT(*) AS onlineCount FROM user_session WHERE expires_at > NOW()`);
  return { onlineCount: result?.onlineCount || 0 };
}