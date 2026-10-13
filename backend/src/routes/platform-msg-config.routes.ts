import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePlatformPermission } from "../middleware/platform-rbac";
import {
  getMsgConfigHandler,
  updateMsgConfigHandler,
  listSmsTemplatesHandler,
  createSmsTemplateHandler,
  updateSmsTemplateHandler,
  deleteSmsTemplateHandler,
} from "../controllers/platform/msg-config.controller";

export const platformMsgConfigRouter = Router();

// 平台消息配置（总台管理短信/邮件配置 + 短信模板）
// 鉴权与 CSRF 由 routeConfig.auth 声明式统一挂载（auto-routes getAuthMiddlewares），
// 不得在端点内联 requirePlatformAuth —— 内联会绕过 csrfMiddleware（P0 修复 2026-10-01）
//
// S3-193 试点域（平台侧 RBAC 第一个接线域）：4 个**写**端点各挂
// `requirePlatformPermission("sysconfig:manage")` —— 平台权限中间件（middleware/platform-rbac.ts）
// 在声明式 `requirePlatformAuth` + `csrfMiddleware` 之后执行，只有同时满足
// 「平台管理员身份 + 短信/邮件配置域写权限（t_platform_role_permission.can_page_btn=1）」才放行。
// 读端点（GET）本单**不接**（第 50 项范围是写端点；读码 `sysconfig:view` 已在权限点目录内，留待后续批次）。
platformMsgConfigRouter.get("/msg-config", asyncHandler(getMsgConfigHandler));
platformMsgConfigRouter.put(
  "/msg-config",
  requirePlatformPermission("sysconfig:manage"),
  asyncHandler(updateMsgConfigHandler)
);
platformMsgConfigRouter.get("/sms-templates", asyncHandler(listSmsTemplatesHandler));
platformMsgConfigRouter.post(
  "/sms-templates",
  requirePlatformPermission("sysconfig:manage"),
  asyncHandler(createSmsTemplateHandler)
);
platformMsgConfigRouter.put(
  "/sms-templates/:id",
  requirePlatformPermission("sysconfig:manage"),
  asyncHandler(updateSmsTemplateHandler)
);
platformMsgConfigRouter.delete(
  "/sms-templates/:id",
  requirePlatformPermission("sysconfig:manage"),
  asyncHandler(deleteSmsTemplateHandler)
);

export const routeConfig: RouteConfig = {
  prefix: "/api/platform",
  router: platformMsgConfigRouter,
  auth: "requirePlatformAuth",
};
