import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { requirePermission } from "../middleware/rbac-auth";
import {
  PERM_SYSTEM_ALERT_CHECK,
  PERM_SYSTEM_ALERT_HANDLE,
  PERM_SYSTEM_ALERT_RULE_EDIT,
} from "../shared/system-permission-codes";

import * as ctrl from "../controllers/admin/alert.controller";

export const alertRouter = Router();

alertRouter.get("/list", ctrl.listAlerts);
alertRouter.get("/count", ctrl.getAlertCounts);
// S3-237（接线批 10 · 组 1「系统设置/基础域」）：3 行挂 S3-232 已立的新码（`system-permission-codes.ts`，
// 迁移 204 已落 `t_sys_menu`）。三条的前端调用点全仓为 0（`docs/tasks/R101-待立码清单-五域.md` §1.2 表 A
// 第 1~3 行：`api/alert.ts` 只有封装、无页面调用点）⇒ 真实使用者集合 ⊆ {超管, 运营}，接线无 403 回归。
alertRouter.put("/:id/handle", requirePermission(PERM_SYSTEM_ALERT_HANDLE), ctrl.handleAlert);
alertRouter.get("/rules", ctrl.listAlertRules);
alertRouter.put("/rules/:id", requirePermission(PERM_SYSTEM_ALERT_RULE_EDIT), ctrl.updateAlertRule);
alertRouter.post("/check", requirePermission(PERM_SYSTEM_ALERT_CHECK), ctrl.runCheck);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/alerts",
  router: alertRouter,
  auth: "requireAuthWithTenant",
};
