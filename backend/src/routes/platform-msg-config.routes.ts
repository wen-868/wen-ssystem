import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
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
platformMsgConfigRouter.get("/msg-config", asyncHandler(getMsgConfigHandler));
platformMsgConfigRouter.put("/msg-config", asyncHandler(updateMsgConfigHandler));
platformMsgConfigRouter.get("/sms-templates", asyncHandler(listSmsTemplatesHandler));
platformMsgConfigRouter.post("/sms-templates", asyncHandler(createSmsTemplateHandler));
platformMsgConfigRouter.put("/sms-templates/:id", asyncHandler(updateSmsTemplateHandler));
platformMsgConfigRouter.delete("/sms-templates/:id", asyncHandler(deleteSmsTemplateHandler));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform",
  router: platformMsgConfigRouter,
  auth: "requirePlatformAuth",
};
