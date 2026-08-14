import { Router } from "express";
import * as reportPermissionV2Controller from "../controllers/admin/report-permission-v2.controller";
import type { RouteConfig } from "../shared/auto-routes";

// ==================== 报表权限路由 ====================
export const reportPermissionRouter = Router();

reportPermissionRouter.get("/matrix", reportPermissionV2Controller.getPermissionMatrix);
reportPermissionRouter.put("/matrix", reportPermissionV2Controller.updatePermissionMatrix);
reportPermissionRouter.get("/data-scope", reportPermissionV2Controller.getDataScopeConfig);
reportPermissionRouter.put("/data-scope", reportPermissionV2Controller.updateDataScopeConfig);
reportPermissionRouter.get("/my", reportPermissionV2Controller.getMyPermissions);
reportPermissionRouter.get("/audit-logs", reportPermissionV2Controller.getAuditLogs);
reportPermissionRouter.get("/audit-logs/:id", reportPermissionV2Controller.getAuditLogDetail);
reportPermissionRouter.post("/batch", reportPermissionV2Controller.batchSetPermissions);
reportPermissionRouter.get("/user/:userId", reportPermissionV2Controller.getUserPermissions);
reportPermissionRouter.put("/user/:userId", reportPermissionV2Controller.assignUserPermissions);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/report-permissions",
  router: reportPermissionRouter,
  auth: "requireAuthWithTenant",
};
