import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePermission } from "../middleware/rbac-auth";
import {
  PERM_SYSTEM_SMS_TEMPLATE_CREATE,
  PERM_SYSTEM_SMS_TEMPLATE_DELETE,
  PERM_SYSTEM_SMS_TEMPLATE_EDIT,
} from "../shared/system-permission-codes";
import {
  handleListSmsTemplates,
  handleCreateSmsTemplate,
  handleUpdateSmsTemplate,
  handleDeleteSmsTemplate,
} from "../controllers/admin/sms-template.controller";

export const smsTemplateRouter = Router();

// 短信模板管理（真实存储 t_sms_template）
smsTemplateRouter.get("/", asyncHandler(handleListSmsTemplates));
// S3-237（接线批 10 · 组 1「系统设置/基础域」）：3 行挂 S3-232 已立的新码（`system-permission-codes.ts`）。
// 商家侧前端调用点全仓为 0（`docs/tasks/R101-待立码清单-五域.md` §1.2 表 A 第 11~13 行；
// `saas-admin` 的 `/platform/sms-templates` 走平台侧权限点，属另一条线）⇒ 无 403 回归。
smsTemplateRouter.post("/", requirePermission(PERM_SYSTEM_SMS_TEMPLATE_CREATE), asyncHandler(handleCreateSmsTemplate));
smsTemplateRouter.put("/:id", requirePermission(PERM_SYSTEM_SMS_TEMPLATE_EDIT), asyncHandler(handleUpdateSmsTemplate));
smsTemplateRouter.delete("/:id", requirePermission(PERM_SYSTEM_SMS_TEMPLATE_DELETE), asyncHandler(handleDeleteSmsTemplate));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/sms-templates",
  router: smsTemplateRouter,
  auth: "requireAuthWithTenant",
};
