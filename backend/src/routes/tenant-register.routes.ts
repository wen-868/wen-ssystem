import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePlatformAuth } from "../middleware/auth";
import {
  handleApplyTenantRegister, handleListApplications,
  handleGetApplication, handleApproveApplication, handleRejectApplication
} from "../controllers/admin/tenant-register.controller";

export const tenantRegisterRouter = Router();

// POST /api/tenant/register - 租户自助注册（公开接口）
tenantRegisterRouter.post("/register", asyncHandler(handleApplyTenantRegister));

// ========== 需要平台管理员认证的审核接口 ==========
tenantRegisterRouter.use("/applications", requirePlatformAuth);

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
