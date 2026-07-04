/**
 * 用户建议反馈服务
 * 表: system_feedback
 */
import { query, queryOne, queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

export interface FeedbackEntry {
  type: "BUG" | "FEATURE" | "IMPROVEMENT" | "OTHER";
  title: string;
  content: string;
  contact?: string;
  screenshot_urls?: string;
  page_url?: string;
  browser_info?: string;
  user_id?: number;
  tenant_id: string;
}

export interface FeedbackQuery {
  type?: string;
  status?: string;
  keyword?: string;
  page: number;
  pageSize: number;
  tenant_id: string;
}

export async function insertFeedback(entry: FeedbackEntry): Promise<number> {
  const sql = `
    INSERT INTO system_feedback
    (type, title, content, contact, screenshot_urls, page_url, browser_info, user_id, tenant_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
  `;
  const result = await query(sql, [
    entry.type,
    entry.title,
    entry.content,
    entry.contact || null,
    entry.screenshot_urls || null,
    entry.page_url || null,
    entry.browser_info || null,
    entry.user_id || null,
    entry.tenant_id,
  ]) as any;
  return result.insertId;
}

export async function listFeedbacks(params: FeedbackQuery) {
  const conditions: string[] = ["f.tenant_id = ?"];
  const values: any[] = [params.tenant_id];

  if (params.type) {
    conditions.push("f.type = ?");
    values.push(params.type);
  }
  if (params.status) {
    conditions.push("f.status = ?");
    values.push(params.status);
  }
  if (params.keyword) {
    conditions.push("(f.title LIKE ? OR f.content LIKE ?)");
    const kw = `%${params.keyword}%`;
    values.push(kw, kw);
  }

  const where = conditions.join(" AND ");
  const offset = (params.page - 1) * params.pageSize;

  const [rows, countResult] = await Promise.all([
    queryWithTenant(
      `SELECT f.*, u.real_name AS userName
       FROM system_feedback f
       LEFT JOIN sys_user u ON u.id = f.user_id
       WHERE ${where}
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, params.pageSize, offset],
      params.tenant_id
    ),
    queryOneWithTenant(
      `SELECT COUNT(*) AS total FROM system_feedback f WHERE ${where}`,
      values,
      params.tenant_id
    ),
  ]);

  return {
    list: rows,
    total: (countResult as any)?.total ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

export async function updateFeedbackStatus(
  id: number,
  status: "PENDING" | "PROCESSING" | "RESOLVED" | "REJECTED",
  reply?: string,
  tenant_id?: string
) {
  const sql = reply
    ? `UPDATE system_feedback SET status = ?, reply = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?`
    : `UPDATE system_feedback SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?`;
  const values = reply ? [status, reply, id, tenant_id] : [status, id, tenant_id];
  await query(sql, values);
}