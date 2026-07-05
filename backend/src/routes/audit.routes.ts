import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as ctrl from "../controllers/audit.controller.js";
import { writeAuditLog } from "../services/admin/audit.service.js";
import type { Request } from "express";

export const auditRouter = Router();

// ========== 审计日志查询（分页+筛选） ==========
auditRouter.get("/", requireAuthWithTenant, ctrl.listAuditLogs);

// ========== 审计日志统计 ==========
auditRouter.get("/statistics", requireAuthWithTenant, ctrl.getAuditStatistics);

// ========== 审计日志工具函数 ==========
export interface LogAuditParams {
  userId: number;
  userName: string;
  role: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  detail?: string;
  tenantId: number;
  req: Request;
}

export function logAudit(p: LogAuditParams): void {
  writeAuditLog(p);
}
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/audit-logs",
  router: auditRouter,
  auth: "requireAuthWithTenant",
};
