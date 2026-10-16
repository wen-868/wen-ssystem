import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { requirePermission } from "../middleware/rbac-auth";
import { PERM_SYSTEM_ARCHIVE_EXECUTE } from "../shared/system-permission-codes";

import * as archiveController from "../controllers/admin/archive.controller";

export const archiveRouter = Router();

// S3-237（接线批 10 · 组 1「系统设置/基础域」）：挂 S3-232 已立的新码 `system:archive:execute`
// （`system-permission-codes.ts`）。前端调用点全仓为 0 ⇒ 真实使用者集合 ⊆ {超管, 运营}，无 403 回归。
archiveRouter.post("/execute", requirePermission(PERM_SYSTEM_ARCHIVE_EXECUTE), archiveController.executeArchive);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/archive",
  router: archiveRouter
};
