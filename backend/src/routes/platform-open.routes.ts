import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePlatformPermission } from "../middleware/platform-rbac";
import * as keyController from "../controllers/platform/platform-open-api-key.controller";
import * as webhookController from "../controllers/platform/platform-open-webhook.controller";

/**
 * R101-C3-1 开放平台路由（prefix /api/platform/open）
 *
 * 依据：`docs/tasks/cards/R101-C3-0-凌舟裁定.md` §三.1 + 派单卡 C3-1 交付物 1。
 * 鉴权：`routeConfig.auth = "requirePlatformAuth"`（由 `shared/auto-routes.ts` 统一挂载
 *       `requirePlatformAuth + csrfMiddleware`，**不手写注册**、不在 router 内重复 `.use`）。
 * 注册顺序：同一 router 内先具体后通配 —— `/:id` 的动作子路由（enable/rotate/rotate-complete）
 *           与 `/:id/stats` 均写在该前缀下的 `PUT|DELETE /:id` 之前，避免被通配抢先匹配。
 * 租户下拉：按裁定 §二.1（A）复用现成 `GET /api/platform/tenants`（本文件**不新增**该端点的副本）。
 */

export const platformOpenRouter = Router();

// ─── S3-219（收口总清单第 67 项）：本文件 10 个**写**端点挂平台侧写权限码 `open:manage` ───
// 形态与 S3-193 试点域逐字对齐：权限码写在**端点声明的中间件位**（字面量，不抽常量 —— G4 门禁
// `guard-rbac-wiring.mjs` 按调用文本识别）；认证 + CSRF 仍由下方 routeConfig.auth 声明式统一挂载。
// 放行判据：平台超管全通；其余角色需 `t_platform_role_permission` 的 open 域 can_page_btn = 1。
// 读端点（GET）本单不接（第 67 项范围是写端点，同 S3-193 口径）。

// ─── 密钥管理（复用 t_library_api_key，AppKey 一律服务端打码） ─────────
// GET /api/platform/open/api-keys - 密钥列表
platformOpenRouter.get("/api-keys", asyncHandler(keyController.listApiKeys));
// POST /api/platform/open/api-keys - 签发密钥（明文 AppSecret 仅一次）
platformOpenRouter.post(
  "/api-keys",
  requirePlatformPermission("open:manage"),
  asyncHandler(keyController.createApiKey)
);
// POST /api/platform/open/api-keys/:id/enable - 启用
platformOpenRouter.post(
  "/api-keys/:id/enable",
  requirePlatformPermission("open:manage"),
  asyncHandler(keyController.enableApiKey)
);
// POST /api/platform/open/api-keys/:id/rotate - 轮换（新密钥一次 + 旧密钥 7 天并行）
platformOpenRouter.post(
  "/api-keys/:id/rotate",
  requirePlatformPermission("open:manage"),
  asyncHandler(keyController.rotateApiKey)
);
// POST /api/platform/open/api-keys/:id/rotate-complete - 完成轮换（旧密钥立即失效）
platformOpenRouter.post(
  "/api-keys/:id/rotate-complete",
  requirePlatformPermission("open:manage"),
  asyncHandler(keyController.completeRotation)
);
// GET /api/platform/open/api-keys/:id/stats - 调用统计（近 7 日）
platformOpenRouter.get("/api-keys/:id/stats", asyncHandler(keyController.getApiKeyStats));
// PUT /api/platform/open/api-keys/:id - 编辑
platformOpenRouter.put(
  "/api-keys/:id",
  requirePlatformPermission("open:manage"),
  asyncHandler(keyController.updateApiKey)
);
// DELETE /api/platform/open/api-keys/:id - 吊销
platformOpenRouter.delete(
  "/api-keys/:id",
  requirePlatformPermission("open:manage"),
  asyncHandler(keyController.deleteApiKey)
);

// ─── 事件目录 ──────────────────────────────────────────────────
// GET /api/platform/open/events - 事件类型目录（常量）
platformOpenRouter.get("/events", asyncHandler(webhookController.listEvents));

// ─── Webhook 订阅 ─────────────────────────────────────────────
// GET /api/platform/open/webhooks - 订阅列表
platformOpenRouter.get("/webhooks", asyncHandler(webhookController.listWebhooks));
// POST /api/platform/open/webhooks - 新建订阅（签名密钥仅一次）
platformOpenRouter.post(
  "/webhooks",
  requirePlatformPermission("open:manage"),
  asyncHandler(webhookController.createWebhook)
);
// POST /api/platform/open/webhooks/:id/test - 测试推送
platformOpenRouter.post(
  "/webhooks/:id/test",
  requirePlatformPermission("open:manage"),
  asyncHandler(webhookController.testWebhook)
);
// POST /api/platform/open/webhooks/:id/redeliver - 手动重推
platformOpenRouter.post(
  "/webhooks/:id/redeliver",
  requirePlatformPermission("open:manage"),
  asyncHandler(webhookController.redeliver)
);
// POST /api/platform/open/webhooks/:id/resume - 恢复订阅
platformOpenRouter.post(
  "/webhooks/:id/resume",
  requirePlatformPermission("open:manage"),
  asyncHandler(webhookController.resumeWebhook)
);
// GET /api/platform/open/webhooks/:id/logs - 投递日志
platformOpenRouter.get("/webhooks/:id/logs", asyncHandler(webhookController.listDeliveries));
// GET /api/platform/open/webhooks/:id/failures - 失败原因
platformOpenRouter.get("/webhooks/:id/failures", asyncHandler(webhookController.listFailures));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/open",
  router: platformOpenRouter,
  auth: "requirePlatformAuth",
};
