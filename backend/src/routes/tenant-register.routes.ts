import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePlatformAuth } from "../middleware/auth";
import { csrfMiddleware } from "../middleware/csrf";
import {
  handleApplyTenantRegister, handleSendRegisterSmsCode, handleGetRegisterConfig, handleListApplications,
  handleGetApplication, handleApproveApplication, handleRejectApplication
} from "../controllers/admin/tenant-register.controller";

export const tenantRegisterRouter = Router();

// POST /api/tenant/register - 租户自助注册（公开接口）
tenantRegisterRouter.post("/register", asyncHandler(handleApplyTenantRegister));

// POST /api/tenant/register/sms-code - 注册验证码（公开接口，真实短信发送）
tenantRegisterRouter.post("/register/sms-code", asyncHandler(handleSendRegisterSmsCode));

// GET /api/tenant/register/config - 注册配置（验证码开关），公开接口
tenantRegisterRouter.get("/register/config", asyncHandler(handleGetRegisterConfig));

// ========== 需要平台管理员认证的审核接口 ==========
// 本文件 routeConfig.auth="none"（注册三端点必须公开），因此审核分支在此显式挂载
// requirePlatformAuth + csrfMiddleware —— approve/reject 写端点必须有 CSRF（P0 修复 2026-10-01）
tenantRegisterRouter.use("/applications", requirePlatformAuth, csrfMiddleware);

// GET /api/tenant/applications - 申请列表
tenantRegisterRouter.get("/applications", asyncHandler(handleListApplications));

// GET /api/tenant/applications/:id - 申请详情
tenantRegisterRouter.get("/applications/:id", asyncHandler(handleGetApplication));

// POST /api/tenant/applications/:id/approve - 通过申请
tenantRegisterRouter.post("/applications/:id/approve", asyncHandler(handleApproveApplication));

// POST /api/tenant/applications/:id/reject - 驳回申请
tenantRegisterRouter.post("/applications/:id/reject", asyncHandler(handleRejectApplication));

export const routeConfig: RouteConfig = {
  prefix: "/api/tenant",
  router: tenantRegisterRouter,
  auth: "none"
};
