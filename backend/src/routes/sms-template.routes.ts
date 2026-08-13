import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import {
  handleListSmsTemplates,
  handleCreateSmsTemplate,
  handleUpdateSmsTemplate,
  handleDeleteSmsTemplate,
} from "../controllers/admin/sms-template.controller";

export const smsTemplateRouter = Router();

// 短信模板管理（真实存储 t_sms_template）
smsTemplateRouter.get("/", asyncHandler(handleListSmsTemplates));
smsTemplateRouter.post("/", asyncHandler(handleCreateSmsTemplate));
smsTemplateRouter.put("/:id", asyncHandler(handleUpdateSmsTemplate));
smsTemplateRouter.delete("/:id", asyncHandler(handleDeleteSmsTemplate));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/sms-templates",
  router: smsTemplateRouter,
  auth: "requireAuthWithTenant",
};
