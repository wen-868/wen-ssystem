import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePlatformAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/tenant.controller";
import * as usageController from "../controllers/platform/tenant-usage.controller";
import * as quotaController from "../controllers/platform/tenant-quota.controller";
import * as statsController from "../controllers/platform/tenant-status-stats.controller";
import * as exportController from "../controllers/platform/tenant-export.controller";
import * as overviewController from "../controllers/platform/tenant-overview.controller";
import * as opsController from "../controllers/platform/tenant-ops.controller";

export const platformTenantRouter = Router();

// 所有平台租户管理接口需要平台管理员认证
platformTenantRouter.use(requirePlatformAuth);

// GET /api/platform/tenants - 租户列表
platformTenantRouter.get("/", asyncHandler(controller.listPlatformTenants));

// R97-01: 租户使用统计/排行（必须注册在 /:id 之前，避免被当作 id 捕获）
platformTenantRouter.get("/usage-stats", asyncHandler(usageController.getUsageStatsCtrl));
platformTenantRouter.get("/rank", asyncHandler(usageController.getRankCtrl));

// C1-2 A1/A2：各状态租户计数 + 列表导出（同样必须注册在 /:id 之前，否则会被 /:id 捕获）
platformTenantRouter.get("/stats", statsController.getTenantStatusStatsCtrl);
platformTenantRouter.get("/export", exportController.exportTenantsCtrl);

// GET /api/platform/tenants/:id - 租户详情
platformTenantRouter.get("/:id", asyncHandler(controller.getPlatformTenantById));

// R101-S2-01 批 4：租户「资源配额使用情况」只读聚合（与 /:id 段数不同，不会冲突，挨着写）
platformTenantRouter.get("/:id/quota", asyncHandler(quotaController.getTenantQuotaCtrl));

// C1-2 A3：单租户概况聚合（只读）
platformTenantRouter.get("/:id/overview", overviewController.getTenantOverviewCtrl);

// POST /api/platform/tenants - 创建租户
platformTenantRouter.post("/", asyncHandler(controller.createPlatformTenant));

// PUT /api/platform/tenants/:id - 更新租户
platformTenantRouter.put("/:id", asyncHandler(controller.updatePlatformTenant));

// POST /api/platform/tenants/:id/toggle - 启用/禁用租户
platformTenantRouter.post("/:id/toggle", asyncHandler(controller.togglePlatformTenantStatus));

// C1-2 A4/A5：代登录 / 临时扩容（写操作，均写 t_platform_audit_log 留痕）
platformTenantRouter.post("/:id/proxy-login", opsController.proxyLoginCtrl);
platformTenantRouter.post("/:id/quota-expand", opsController.expandTenantQuotaCtrl);

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/tenants",
  router: platformTenantRouter,
  auth: "requirePlatformAuth",
};
