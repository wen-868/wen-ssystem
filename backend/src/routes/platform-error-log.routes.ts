import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/error-log.controller";

// R97-01: 平台版错误日志（全租户范围，requirePlatformAuth）
export const platformErrorLogRouter = Router();

// S3-179 ②：平台端前端错误上报（同端）。
// saas-admin 原先打 /api/admin/error-report（requireAuthWithTenant = 商家端鉴权）⇒ 平台令牌恒 401 被静默丢弃；
// 这里复用本文件既有的 prefix "/api/platform" 与 auth "requirePlatformAuth"（CSRF 由 auto-routes 声明式附带），
// 不新增前缀、不新增表（最小实现：落日志）。
platformErrorLogRouter.post("/error-report", asyncHandler(controller.reportPlatformFrontendError));

// GET /api/platform/error-logs - 错误日志列表
platformErrorLogRouter.get("/error-logs", asyncHandler(controller.listPlatformErrorLogs));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform",
  router: platformErrorLogRouter,
  auth: "requirePlatformAuth",
};
