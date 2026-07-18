import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePlatformAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/tenant.controller";

export const platformTenantRouter = Router();

// 所有平台租户管理接口需要平台管理员认证
platformTenantRouter.use(requirePlatformAuth);

// GET /api/platform/tenants - 租户列表
platformTenantRouter.get("/", asyncHandler(controller.listPlatformTenants));

// GET /api/platform/tenants/:id - 租户详情
platformTenantRouter.get("/:id", asyncHandler(controller.getPlatformTenantById));

// POST /api/platform/tenants - 创建租户
platformTenantRouter.post("/", asyncHandler(controller.createPlatformTenant));

// PUT /api/platform/tenants/:id - 更新租户
platformTenantRouter.put("/:id", asyncHandler(controller.updatePlatformTenant));

// POST /api/platform/tenants/:id/toggle - 启用/禁用租户
platformTenantRouter.post("/:id/toggle", asyncHandler(controller.togglePlatformTenantStatus));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/tenants",
  router: platformTenantRouter,
  auth: "requirePlatformAuth",
};
