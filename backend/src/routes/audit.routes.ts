import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne, pool } from "../shared/db.js";
import { ok } from "../shared/response.js";
import type { Request } from "express";

export const auditRouter = Router();

// ========== 审计日志查询（分页+筛选） ==========
auditRouter.get("/", asyncHandler(async (req, res) => {
  const schema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    userId: z.coerce.number().optional(),
    action: z.string().optional(),
    resourceType: z.string().optional(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional()
  });
  const params = schema.parse(req.query);
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = [];
  const sqlParams: unknown[] = [];

  if (params.userId) {
    conditions.push("user_id = ?");
    sqlParams.push(params.userId);
  }
  if (params.action) {
    conditions.push("action = ?");
    sqlParams.push(params.action);
  }
  if (params.resourceType) {
    conditions.push("resource_type = ?");
    sqlParams.push(params.resourceType);
  }
  if (params.dateStart) {
    conditions.push("DATE(created_at) >= ?");
    sqlParams.push(params.dateStart);
  }
  if (params.dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    sqlParams.push(params.dateEnd);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM audit_log ${where}`,
    sqlParams
  );
  const total = totalRow?.total ?? 0;

  const records = await query<any>(
    `SELECT id, user_id AS userId, user_name AS userName, role,
            action, resource_type AS resourceType, resource_id AS resourceId,
            detail, ip, user_agent AS userAgent, created_at AS createdAt
     FROM audit_log ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset]
  );

  res.json(ok({ total, page: params.page, pageSize: params.pageSize, records }));
}));

// ========== 审计日志统计 ==========
auditRouter.get("/statistics", asyncHandler(async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const monthStart = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [todayCount, weekCount, monthCount, actionDist, userDist] = await Promise.all([
    queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM audit_log WHERE DATE(created_at) = ?`, [today]),
    queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM audit_log WHERE DATE(created_at) >= ?`, [weekStart]),
    queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM audit_log WHERE DATE(created_at) >= ?`, [monthStart]),
    query<{ action: string; cnt: number }>(`SELECT action, COUNT(*) AS cnt FROM audit_log WHERE DATE(created_at) >= ? GROUP BY action ORDER BY cnt DESC`, [weekStart]),
    query<{ userName: string; cnt: number }>(`SELECT user_name AS userName, COUNT(*) AS cnt FROM audit_log WHERE DATE(created_at) >= ? GROUP BY user_name ORDER BY cnt DESC LIMIT 10`, [weekStart])
  ]);

  res.json(ok({
    todayCount: todayCount?.cnt ?? 0,
    weekCount: weekCount?.cnt ?? 0,
    monthCount: monthCount?.cnt ?? 0,
    actionDistribution: actionDist,
    userDistribution: userDist
  }));
}));

// ========== 审计日志工具函数 ==========
export interface LogAuditParams {
  userId: number;
  userName: string;
  role: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  detail?: string;
  req: Request;
}

/**
 * 异步写入审计日志，不阻塞业务流程
 */
export function logAudit(p: LogAuditParams): void {
  const ip = (p.req.ip || p.req.socket?.remoteAddress || "").replace("::ffff:", "");
  const userAgent = p.req.headers["user-agent"] || "";

  // 异步写入，不 await
  pool
    .query(
      `INSERT INTO audit_log (user_id, user_name, role, action, resource_type, resource_id, detail, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.userId, p.userName, p.role, p.action, p.resourceType, p.resourceId ?? null, p.detail ?? null, ip, userAgent]
    )
    .catch((err) => {
      console.error("[audit] 写入审计日志失败:", err);
    });
}
