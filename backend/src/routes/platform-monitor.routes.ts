import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePlatformAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import { trackRequest, getMonitorStats } from "../controllers/platform/platform-monitor.controller";
import * as adminMonitor from "../controllers/admin/monitor.controller";
import { getSlowQueries } from "../middleware/slow-query-monitor";

export const platformMonitorRouter = Router();

platformMonitorRouter.use((_req, _res, next) => {
  trackRequest();
  next();
});

platformMonitorRouter.get("/", requirePlatformAuth, asyncHandler(getMonitorStats));

// ========== R97-01: 补平台版监控端点（复用 admin monitor 控制器，全租户/平台视角） ==========
// GET /api/platform/monitor/db-status - 数据库状态
platformMonitorRouter.get("/db-status", adminMonitor.getDbStatusCtrl);

// GET /api/platform/monitor/api-stats - API 调用统计
platformMonitorRouter.get("/api-stats", adminMonitor.getApiStatsCtrl);

// GET /api/platform/monitor/slow-queries - 最近慢查询（>100ms）
platformMonitorRouter.get("/slow-queries", (_req, res) => {
  res.json({ code: "0", msg: "成功", data: getSlowQueries() });
});

// GET /api/platform/monitor/expiring-tenants - 即将到期租户
platformMonitorRouter.get("/expiring-tenants", adminMonitor.getExpiringTenantsCtrl);

// POST /api/platform/monitor/notify-expiring - 通知即将到期租户
platformMonitorRouter.post("/notify-expiring", adminMonitor.notifyExpiringTenantsCtrl);

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/monitor",
  router: platformMonitorRouter,
  auth: "requirePlatformAuth",
};
