import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePlatformAuth } from "../middleware/auth";
import {
  handleListApplications,
  handleGetApplication,
  handleApproveApplication,
  handleRejectApplication
} from "../controllers/admin/tenant-register.controller";

export const platformApplicationsRouter = Router();

// 入驻申请查询与审核需要平台管理员认证
platformApplicationsRouter.use("/applications", requirePlatformAuth);

// GET /api/platform/applications - 申请列表
platformApplicationsRouter.get("/applications", asyncHandler(handleListApplications));

// GET /api/platform/applications/:id - 申请详情
platformApplicationsRouter.get("/applications/:id", asyncHandler(handleGetApplication));

// PUT /api/platform/applications/:id/approve - 审核通过
platformApplicationsRouter.put("/applications/:id/approve", asyncHandler(handleApproveApplication));

// PUT /api/platform/applications/:id/reject - 审核驳回
platformApplicationsRouter.put("/applications/:id/reject", asyncHandler(handleRejectApplication));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform",
  router: platformApplicationsRouter,
  auth: "none",
};