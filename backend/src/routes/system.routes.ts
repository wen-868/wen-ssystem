import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";
import { PERM_SYSTEM_MIGRATION_RUN } from "../shared/system-permission-codes";

import { healthCheck, getSystemInfo, runSystemMigration } from "../controllers/admin/system.controller";

export const systemRouter = Router();

systemRouter.get("/health", asyncHandler(healthCheck));
systemRouter.get("/info", asyncHandler(getSystemInfo));
// S3-237（接线批 10 · 组 1「系统设置/基础域」）：运维入口挂 S3-232 已立的新码 `system:migration:run`
// （`system-permission-codes.ts`）。前端调用点全仓为 0（运维触发）⇒ 无 403 回归。
systemRouter.post("/migrate", requirePermission(PERM_SYSTEM_MIGRATION_RUN), asyncHandler(runSystemMigration));

export const routeConfig: RouteConfig = {
  prefix: "/api/system",
  router: systemRouter,
  auth: "requireAuthWithTenant",
};
