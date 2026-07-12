import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as ctrl from "../controllers/admin/audit.controller";
export { logAudit, type LogAuditParams } from "../utils/audit-log";

export const auditRouter = Router();

auditRouter.get("/", requireAuthWithTenant, ctrl.listAuditLogs);
auditRouter.get("/statistics", requireAuthWithTenant, ctrl.getAuditStatistics);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/audit-logs",
  router: auditRouter,
  auth: "requireAuthWithTenant",
};
