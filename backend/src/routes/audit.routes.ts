import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/admin/audit.controller";
export { logAudit, type LogAuditParams } from "../utils/audit-log";

export const auditRouter = Router();

auditRouter.get("/", ctrl.listAuditLogs);
auditRouter.get("/statistics", ctrl.getAuditStatistics);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/system/audit-logs",
  router: auditRouter,
  auth: "requireAuthWithTenant",
};
