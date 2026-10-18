import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePlatformPermission } from "../middleware/platform-rbac";
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

// ─── S3-238（平台侧接线第一批 R3）：本文件 2 个**写**端点挂平台侧写权限码 `tenant:manage` ───
// 形态与 S3-219（platform-review.routes.ts）逐字对齐：权限码写在**端点声明的中间件位**（字面量，
// 不抽常量 —— G4 门禁 `guard-rbac-wiring.mjs` 按调用文本识别）；
// 认证（requirePlatformAuth）+ CSRF 仍由下方 routeConfig.auth 声明式统一挂载 ⇒ 本中间件必然晚于两者。
// 放行判据：平台超管（PLATFORM_SUPER_ADMIN / SUPER_ADMIN）全通；其余角色需
// `t_platform_role_permission` 的 tenant 域 can_page_btn = 1（未配/矩阵缺失/DB 异常 ⇒ 403 fail-closed）。
// ⚠️ 双前缀同业务：同一审核还有 `/api/tenant/applications/:id/{approve,reject}` 一份
// （`tenant-register.routes.ts`，挂平台认证但不在 platform*.routes.ts 扫描面内）——**两侧必须同时接**，
// 否则未接的那侧即绕过点（台账 §六 105+1 / 105+2 已登记）。
// 读端点（GET 列表/详情）本单不接（同 S3-193 / S3-219 口径：只接写端点）。

// PUT /api/platform/applications/:id/approve - 审核通过
platformApplicationsRouter.put(
  "/:id/approve",
  requirePlatformPermission("tenant:manage"),
  asyncHandler(handleApproveApplication)
);

// PUT /api/platform/applications/:id/reject - 审核驳回
platformApplicationsRouter.put(
  "/:id/reject",
  requirePlatformPermission("tenant:manage"),
  asyncHandler(handleRejectApplication)
);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/platform/applications",
  router: platformApplicationsRouter,
  auth: "requirePlatformAuth",
};
