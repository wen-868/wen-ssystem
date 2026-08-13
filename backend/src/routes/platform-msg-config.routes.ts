import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePlatformAuth } from "../middleware/auth";
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
platformMsgConfigRouter.get("/msg-config", requirePlatformAuth, asyncHandler(getMsgConfigHandler));
platformMsgConfigRouter.put("/msg-config", requirePlatformAuth, asyncHandler(updateMsgConfigHandler));
platformMsgConfigRouter.get("/sms-templates", requirePlatformAuth, asyncHandler(listSmsTemplatesHandler));
platformMsgConfigRouter.post("/sms-templates", requirePlatformAuth, asyncHandler(createSmsTemplateHandler));
platformMsgConfigRouter.put("/sms-templates/:id", requirePlatformAuth, asyncHandler(updateSmsTemplateHandler));
platformMsgConfigRouter.delete("/sms-templates/:id", requirePlatformAuth, asyncHandler(deleteSmsTemplateHandler));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform",
  router: platformMsgConfigRouter,
  auth: "none",
};
