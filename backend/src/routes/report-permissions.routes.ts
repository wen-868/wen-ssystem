import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import * as reportPermissionV2Controller from "../controllers/admin/report-permission-v2.controller";
import type { RouteConfig } from "../shared/auto-routes";

// ==================== 报表权限路由 ====================
export const reportPermissionRouter = Router();

reportPermissionRouter.get("/matrix", requireAuthWithTenant, reportPermissionV2Controller.getPermissionMatrix);
reportPermissionRouter.put("/matrix", requireAuthWithTenant, reportPermissionV2Controller.updatePermissionMatrix);
reportPermissionRouter.get("/data-scope", requireAuthWithTenant, reportPermissionV2Controller.getDataScopeConfig);
reportPermissionRouter.put("/data-scope", requireAuthWithTenant, reportPermissionV2Controller.updateDataScopeConfig);
reportPermissionRouter.get("/my", requireAuthWithTenant, reportPermissionV2Controller.getMyPermissions);
reportPermissionRouter.get("/audit-logs", requireAuthWithTenant, reportPermissionV2Controller.getAuditLogs);
reportPermissionRouter.get("/user/:userId", requireAuthWithTenant, reportPermissionV2Controller.getUserPermissions);
reportPermissionRouter.put("/user/:userId", requireAuthWithTenant, reportPermissionV2Controller.assignUserPermissions);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/report-permissions",
  router: reportPermissionRouter,
  auth: "requireAuthWithTenant",
};
