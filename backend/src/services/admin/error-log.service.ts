import { query, queryOne } from "../../shared/db.js";

export interface ErrorLogEntry {
  error_type: string;
  severity: "WARN" | "ERROR" | "FATAL";
  message: string;
  stack?: string;
  request_url?: string;
  request_method?: string;
  status_code?: number;
  user_id?: string;
  tenant_id?: string;
  source?: "backend" | "frontend";
}

export async function insertErrorLog(entry: ErrorLogEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO error_logs 
       (error_type, severity, message, stack, request_url, request_method, status_code, user_id, tenant_id, source) 
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        entry.error_type,
        entry.severity,
        entry.message,
        entry.stack || null,
        entry.request_url || null,
        entry.request_method || null,
        entry.status_code || null,
        entry.user_id || null,
        entry.tenant_id || null,
        entry.source || "backend",
      ]
    );
  } catch (dbError) {
    console.error("[error-log] 写入 error_logs 失败:", dbError);
  }
}

export async function listErrorLogs(params: {
  error_type?: string;
  severity?: string;
  source?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}): Promise<{ items: any[]; total: number }> {
  const conditions: string[] = [];
  const values: any[] = [];

  if (params.error_type) {
    conditions.push("error_type = ?");
    values.push(params.error_type);
  }
  if (params.severity) {
    conditions.push("severity = ?");
    values.push(params.severity);
  }
  if (params.source) {
    conditions.push("source = ?");
    values.push(params.source);
  }
  if (params.keyword) {
    conditions.push("(message LIKE ? OR request_url LIKE ?)");
    values.push(`%${params.keyword}%`, `%${params.keyword}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (params.page - 1) * params.pageSize;

  const [rows, countResult] = await Promise.all([
    query(
      `SELECT * FROM error_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...values, params.pageSize, offset]
    ),
    queryOne(`SELECT COUNT(*) AS total FROM error_logs ${where}`, values),
  ]);

  return { items: rows, total: (countResult as { total?: number } | null)?.total || 0 };
}

export async function cleanupOldLogs(retainDays: number = 30): Promise<number> {
  const result = await queryOne(
    `DELETE FROM error_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [retainDays]
  );
  return (result as { affectedRows?: number } | null)?.affectedRows || 0;
}
