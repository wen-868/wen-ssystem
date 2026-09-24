import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePlatformAuth } from "../middleware/auth";
import * as controller from "../controllers/platform/ai-platform.controller";

/**
 * R101-C5-1（阶段一 C5）：AI 配置与用量 · 平台侧只读路由
 *
 * 前缀 `/api/platform/ai`（**凌舟钉死，不得改名**，前端单 C5-2 逐字照此对接）。
 * 与既有 `/api/platform/ai-billing`（`routes/ai-billing.routes.ts`）按 **URL 段边界**区分，
 * Express `app.use(prefix)` 不会互相吞并；同名路径段也不存在（`backend/src` 内此前 `/platform/ai/` 0 命中）。
 *
 * 鉴权：`requirePlatformAuth`（平台总后台）。该中间件**不注入 `req.tenantId`**，
 * 控制器/服务层不得读该字段（踩坑日志 [35]／S3-86／S3-91）。与 `ai-billing.routes.ts` 同形：
 * router 级 `.use(requirePlatformAuth)` + routeConfig 的 `auth: "requirePlatformAuth"` 双保险。
 */
export const aiPlatformRouter = Router();

aiPlatformRouter.use(requirePlatformAuth);

// 4 条只读 GET（静态路径，无 `:param` 通配，顺序无冲突）
aiPlatformRouter.get("/public-models", asyncHandler(controller.listPublicModelsCtrl));
aiPlatformRouter.get("/metering-log", asyncHandler(controller.listMeteringLogCtrl));
aiPlatformRouter.get("/abnormal-tenants", asyncHandler(controller.listAbnormalTenantsCtrl));
aiPlatformRouter.get("/model-share", asyncHandler(controller.getModelShareCtrl));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/ai",
  router: aiPlatformRouter,
  auth: "requirePlatformAuth",
};
