import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePlatformAuth } from "../middleware/auth";
import { requirePlatformPermission } from "../middleware/platform-rbac";
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

// ─── S3-238（平台侧接线第一批 R3）：双前缀同业务，**本侧必须一起接** ───
// 同一审核业务存在两个前缀：本文件的 `/api/tenant/applications/*` 与
// `platform-applications.routes.ts` 的 `/api/platform/applications/*`（二者指向同一 controller）。
// 只接一侧 ⇒ 未接的那侧即**绕过点**，故本单两侧同接（台账 §六 105+1 / 105+2）。
// ⚠️ 本文件是**商家侧文件名**（不在 `platform*.routes.ts` 扫描面内）⇒ 生成器与门禁基线扫不到它，
// 判据只能靠**行级形状断言**（见 `backend/src/__tests__/routes/rbac-b2-s3-238-platform-wiring.test.ts`）。
// 挂载顺序：认证 + CSRF 由 :25 的 `router.use("/applications", …)` 前置挂载 ⇒ 本中间件在其后，合规。

// POST /api/tenant/applications/:id/approve - 通过申请
tenantRegisterRouter.post(
  "/applications/:id/approve",
  requirePlatformPermission("tenant:manage"),
  asyncHandler(handleApproveApplication)
);

// POST /api/tenant/applications/:id/reject - 驳回申请
tenantRegisterRouter.post(
  "/applications/:id/reject",
  requirePlatformPermission("tenant:manage"),
  asyncHandler(handleRejectApplication)
);

export const routeConfig: RouteConfig = {
  prefix: "/api/tenant",
  router: tenantRegisterRouter,
  auth: "none"
};
