import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/platform-export-task.controller";

/**
 * C6-2-T2-F1：平台报表导出任务中心路由（6 条端点，路径由 F1 派单卡钉死，不得自拟/增减）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T2-F1.md 交付物①
 *       + 该卡「R7 派单前内部一致性澄清」第 1 条（6 条即全集，无第 7 条详情端点）
 * 前缀 `/api/platform/reports/export` = **前端既有字面契约**
 * （saas-admin/src/views/Dashboard.vue :354 创建 / :344 status / :347 download / :350 logs；
 *  本单逐字对齐前端，不再使用 T2 卡里自拟的 /api/platform/export-tasks）。
 * 全部挂 requirePlatformAuth（与既有平台路由同风格）。
 *
 * 注册顺序说明：列表/创建是 **0 段**（`/`），:id 子路径是 **2 段**（`/:id/status|download|logs|retry`），
 * 段数不同无冲突；四条 :id 子路径的第二段都是字面量（本前缀下没有裸 `/:id`）⇒ 无"字面量 vs 通配"歧义，
 * 仍按"字面量在前"排列。
 * 本文件不写任何业务逻辑（分层规则：route 只注册）；各端点权限点见控制器头部注释
 * （export:view / export:create / export:retry，常量定义在服务层 EXPORT_TASK_PERMISSIONS）。
 */

export const platformExportTaskRouter = Router();

// GET /api/platform/reports/export —— 任务列表（分页 + status 筛选；空表 ⇒ records: []）
platformExportTaskRouter.get("/", asyncHandler(controller.listExportTasks));
// POST /api/platform/reports/export —— 创建任务（创建即 PENDING，等待生成器接入）
platformExportTaskRouter.post("/", asyncHandler(controller.createExportTask));

// GET /api/platform/reports/export/:id/status —— 任务状态（T2 详情记录的超集；不存在 404）
platformExportTaskRouter.get("/:id/status", asyncHandler(controller.getExportTaskStatus));
// GET /api/platform/reports/export/:id/download —— 导出文件下载（无 file_url ⇒ 404 诚实拒绝）
platformExportTaskRouter.get("/:id/download", asyncHandler(controller.downloadExportTask));
// GET /api/platform/reports/export/:id/logs —— 任务日志（created_at 升序）
platformExportTaskRouter.get("/:id/logs", asyncHandler(controller.getExportTaskLogs));
// POST /api/platform/reports/export/:id/retry —— 重排（仅 FAILED → PENDING）
platformExportTaskRouter.post("/:id/retry", asyncHandler(controller.retryExportTask));

export const routeConfigs: RouteConfig[] = [
  {
    prefix: "/api/platform/reports/export",
    router: platformExportTaskRouter,
    auth: "requirePlatformAuth",
  },
];
