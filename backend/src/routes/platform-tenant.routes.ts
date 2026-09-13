import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePlatformAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/tenant.controller";
import * as usageController from "../controllers/platform/tenant-usage.controller";
import * as quotaController from "../controllers/platform/tenant-quota.controller";

export const platformTenantRouter = Router();

// 所有平台租户管理接口需要平台管理员认证
platformTenantRouter.use(requirePlatformAuth);

// GET /api/platform/tenants - 租户列表
platformTenantRouter.get("/", asyncHandler(controller.listPlatformTenants));

// R97-01: 租户使用统计/排行（必须注册在 /:id 之前，避免被当作 id 捕获）
platformTenantRouter.get("/usage-stats", asyncHandler(usageController.getUsageStatsCtrl));
platformTenantRouter.get("/rank", asyncHandler(usageController.getRankCtrl));

// GET /api/platform/tenants/:id - 租户详情
platformTenantRouter.get("/:id", asyncHandler(controller.getPlatformTenantById));

// R101-S2-01 批 4：租户「资源配额使用情况」只读聚合（与 /:id 段数不同，不会冲突，挨着写）
platformTenantRouter.get("/:id/quota", asyncHandler(quotaController.getTenantQuotaCtrl));

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
