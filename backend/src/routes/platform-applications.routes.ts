import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import {
  handleListApplications,
  handleGetApplication,
  handleApproveApplication,
  handleRejectApplication
} from "../controllers/admin/tenant-register.controller";

// R48-05: 入驻申请路由独立前缀 /api/platform/applications
// auth 改为 requirePlatformAuth（由 auto-routes 自动挂载），删除手动 router.use
// 路由内路径去掉 /applications 前缀（prefix 已包含），保持实际请求路径不变
export const platformApplicationsRouter = Router();

// GET /api/platform/applications - 申请列表
platformApplicationsRouter.get("/", asyncHandler(handleListApplications));

// GET /api/platform/applications/:id - 申请详情
platformApplicationsRouter.get("/:id", asyncHandler(handleGetApplication));

// PUT /api/platform/applications/:id/approve - 审核通过
platformApplicationsRouter.put("/:id/approve", asyncHandler(handleApproveApplication));

// PUT /api/platform/applications/:id/reject - 审核驳回
platformApplicationsRouter.put("/:id/reject", asyncHandler(handleRejectApplication));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform/applications",
  router: platformApplicationsRouter,
  auth: "requirePlatformAuth",
};
