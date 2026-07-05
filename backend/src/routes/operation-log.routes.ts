import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { z } from "zod";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { query, queryOne } from "../shared/db.js";
import { ok } from "../shared/response.js";

export const operationLogRouter = Router();

// ========== 操作日志列表（分页+筛选） ==========
operationLogRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const schema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    module: z.string().optional(),
    action: z.string().optional(),
    operatorName: z.string().optional(),
    bizNo: z.string().optional(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
  });
  const params = schema.parse(req.query);
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const sqlParams: unknown[] = [tenantId];

  if (params.module) { conditions.push("module = ?"); sqlParams.push(params.module); }
  if (params.action) { conditions.push("action = ?"); sqlParams.push(params.action); }
  if (params.operatorName) { conditions.push("operator_name LIKE ?"); sqlParams.push(`%${params.operatorName}%`); }
  if (params.bizNo) { conditions.push("biz_no = ?"); sqlParams.push(params.bizNo); }
  if (params.dateStart) { conditions.push("DATE(created_at) >= ?"); sqlParams.push(params.dateStart); }
  if (params.dateEnd) { conditions.push("DATE(created_at) <= ?"); sqlParams.push(params.dateEnd); }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM operation_log ${where}`, sqlParams
  );
  const total = totalRow?.total ?? 0;

  const records = await query<any>(
    `SELECT id, operator_id AS operatorId, operator_name AS operatorName,
            module, action, biz_no AS bizNo, target_id AS targetId,
            target_type AS targetType, after_data AS afterData,
            remark, created_at AS createdAt
     FROM operation_log ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset]
  );

  res.json(ok({ total, page: params.page, pageSize: params.pageSize, records }));
}));

// ========== 操作日志统计 ==========
operationLogRouter.get("/statistics", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [todayCount, weekCount, moduleDist, actionDist] = await Promise.all([
    queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM operation_log WHERE tenant_id = ? AND DATE(created_at) = ?`, [tenantId, today]),
    queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM operation_log WHERE tenant_id = ? AND DATE(created_at) >= ?`, [tenantId, weekStart]),
    query<{ module: string; cnt: number }>(`SELECT module, COUNT(*) AS cnt FROM operation_log WHERE tenant_id = ? AND DATE(created_at) >= ? GROUP BY module ORDER BY cnt DESC LIMIT 10`, [tenantId, weekStart]),
    query<{ action: string; cnt: number }>(`SELECT action, COUNT(*) AS cnt FROM operation_log WHERE tenant_id = ? AND DATE(created_at) >= ? GROUP BY action ORDER BY cnt DESC LIMIT 10`, [tenantId, weekStart]),
  ]);

  res.json(ok({
    todayCount: todayCount?.cnt ?? 0,
    weekCount: weekCount?.cnt ?? 0,
    moduleDistribution: moduleDist,
    actionDistribution: actionDist,
  }));
}));
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/operation-logs",
  router: operationLogRouter,
  auth: "requireAuthWithTenant",
};
