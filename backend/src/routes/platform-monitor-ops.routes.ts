import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/platform-monitor-ops.controller";

/**
 * R101-C4-1b 段二（包C）：平台监控运维端点路由（零 DDL）
 *
 * 前缀 `/api/platform/monitor` 与既有 `platform-monitor.routes.ts`（进程运行态 / db-status /
 * api-stats / slow-queries / expiring-tenants / notify-expiring）**同前缀不同路径段**，
 * auto-routes 各自挂载（与包A/包B 在 `/api/platform/billing` 的处理方式一致）；本文件不改既有路由文件。
 *
 * 鉴权：`requirePlatformAuth`（平台总后台）。该中间件**不注入 `req.tenantId`**
 * ⇒ 控制器与 service 一律不得读该字段（踩坑日志 [35]、S3-86 / S3-91）。
 *
 * 注册顺序：静态路径先于任何 `:param` 通配（踩坑日志 [35]：`/stats`、`/rank` 被 `/:id` 吞掉）。
 */
export const platformMonitorOpsRouter = Router();

// C-1 / C-1x / C-2 代登录审计
platformMonitorOpsRouter.get("/proxy-audit", asyncHandler(controller.listProxyAuditCtrl));
platformMonitorOpsRouter.get("/proxy-audit/export", asyncHandler(controller.exportProxyAuditCtrl));
platformMonitorOpsRouter.get(
  "/proxy-audit/:id/report",
  asyncHandler(controller.getProxyAuditReportCtrl)
);

// C-3 / C-4 存储监控
platformMonitorOpsRouter.get("/storage/top5", asyncHandler(controller.getStorageTop5Ctrl));
platformMonitorOpsRouter.get("/storage/orphan-scan", asyncHandler(controller.orphanScanCtrl));

// C-5 / C-5x 各租户 API 调用量
platformMonitorOpsRouter.get("/tenant-api", asyncHandler(controller.getTenantApiCtrl));
platformMonitorOpsRouter.get("/tenant-api/export", asyncHandler(controller.exportTenantApiCtrl));

// C-6 监控阈值配置（读 / 写）
platformMonitorOpsRouter.get("/thresholds", asyncHandler(controller.getThresholdsCtrl));
platformMonitorOpsRouter.put("/thresholds", asyncHandler(controller.updateThresholdsCtrl));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/monitor",
  router: platformMonitorOpsRouter,
  auth: "requirePlatformAuth",
};
