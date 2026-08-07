import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/error-log.controller";

// R97-01: 平台版错误日志（全租户范围，requirePlatformAuth）
export const platformErrorLogRouter = Router();

// GET /api/platform/error-logs - 错误日志列表
platformErrorLogRouter.get("/error-logs", asyncHandler(controller.listPlatformErrorLogs));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform",
  router: platformErrorLogRouter,
  auth: "requirePlatformAuth",
};
