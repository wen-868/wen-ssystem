import { query, queryOne } from "../../shared/db";

// ==================== 类型定义 ====================

/** 用户会话行（关联用户名） */
interface UserSessionRow {
  id: number;
  user_id: number;
  username: string | null;
  realName: string | null;
  session_token: string;
  expires_at: string | Date;
  last_activity_at: string | Date;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: string | Date;
}

/** 计数行 */
interface CountCntRow {
  cnt: number;
}

/** 在线统计行 */
interface OnlineStatsRow {
  onlineCount: number;
}

export async function getUserSessions(tenantId: string, params?: { userId?: number; page?: number; pageSize?: number }) {
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  let where = "WHERE 1=1";
  const vals: unknown[] = [];
  if (params?.userId) { where += " AND user_id = ?"; vals.push(params.userId); }
  const [rows, total] = await Promise.all([
    query<UserSessionRow>(`SELECT us.*, su.username, su.real_name AS realName FROM t_user_session us LEFT JOIN t_sys_user su ON us.user_id = su.id ${where} ORDER BY us.last_activity_at DESC LIMIT ${offset}, ${pageSize}`, vals),
    queryOne<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_user_session ${where}`, vals)
  ]);
  return { records: rows, total: total?.cnt || 0, page, pageSize };
}

export async function revokeSession(sessionId: number) {
  await query(`DELETE FROM t_user_session WHERE id=?`, [sessionId]);
  return { success: true };
}

export async function getOnlineStats() {
  const result = await queryOne<OnlineStatsRow>(`SELECT COUNT(*) AS onlineCount FROM t_user_session WHERE expires_at > NOW()`);
  return { onlineCount: result?.onlineCount || 0 };
}