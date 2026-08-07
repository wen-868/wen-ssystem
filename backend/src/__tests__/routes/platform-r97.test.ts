import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace" })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace" })),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuthWithTenant: (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
  requirePlatformAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/csrf", () => ({
  csrfMiddleware: (_req: any, _res: any, next: any) => next(),
  generateCsrfToken: vi.fn(() => "test-csrf"),
}));

vi.mock("../../services/admin/error-log.service", () => ({
  insertErrorLog: vi.fn(),
  listErrorLogs: vi.fn(),
  cleanupOldLogs: vi.fn(),
}));

vi.mock("../../services/platform/platform-overview.service", () => ({
  getPlatformOverview: vi.fn(),
  getTenantStatistics: vi.fn(),
  getRevenueStatistics: vi.fn(),
  getPlatformDashboardOverview: vi.fn(),
}));

vi.mock("../../services/platform/tenant-usage.service", () => ({
  getUsageStats: vi.fn(),
  getRank: vi.fn(),
}));

vi.mock("../../services/admin/tenant-usage.service", () => ({
  getStats: vi.fn(),
  getTrend: vi.fn(),
  getModuleUsage: vi.fn(),
  getRanking: vi.fn(),
}));

vi.mock("../../services/platform/platform-sys-config.service", () => ({
  getSysConfig: vi.fn(),
  updateSysConfig: vi.fn(),
}));

import * as errorLogService from "../../services/admin/error-log.service";
import * as overviewService from "../../services/platform/platform-overview.service";
import * as tenantUsageService from "../../services/platform/tenant-usage.service";
import * as sysConfigService from "../../services/platform/platform-sys-config.service";
import { platformErrorLogRouter } from "../../routes/platform-error-log.routes";
import { platformDashboardRouter } from "../../routes/platform-dashboard.routes";
import { platformTenantRouter } from "../../routes/platform-tenant.routes";
import { platformConfigRouter } from "../../routes/platform-config.routes";

describe("R97-01 平台版端点路由测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /api/platform/error-logs", () => {
    const app = createTestApp({ prefix: "/api/platform", router: platformErrorLogRouter });

    it("应返回全租户错误日志（驼峰字段 + records/total）", async () => {
      (errorLogService.listErrorLogs as any).mockResolvedValue({
        items: [{
          id: 1,
          error_type: "http_error",
          severity: "ERROR",
          message: "接口500",
          stack: "stack...",
          request_url: "/api/xxx",
          source: "backend",
          created_at: "2026-08-08 10:00:00",
        }],
        total: 1,
      });
      const res = await request(app).get("/api/platform/error-logs?page=1&pageSize=20");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(errorLogService.listErrorLogs).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 20 })
      );
      expect(res.body.data.records[0]).toEqual(expect.objectContaining({
        errorType: "http_error",
        requestUrl: "/api/xxx",
        createdAt: "2026-08-08 10:00:00",
      }));
      expect(res.body.data.total).toBe(1);
    });
  });

  describe("GET /api/platform/dashboard/overview", () => {
    const app = createTestApp({ prefix: "/api/platform/dashboard", router: platformDashboardRouter });

    it("应返回平台看板总览（对齐 Dashboard.vue 期望结构）", async () => {
      (overviewService.getPlatformDashboardOverview as any).mockResolvedValue({
        totalTenants: 10,
        activeTenants: 8,
        monthlyRevenue: 1000,
        pendingTenants: 1,
        totalRevenue: 5000,
        incomeTrend: [{ period: "2026-07", amount: 500 }],
        planDistribution: [{ planName: "标准版", count: 3 }],
        tenantStatus: [{ status: "ACTIVE", count: 8 }],
        recentTenants: [{ companyName: "测试公司", planName: "标准版", status: "ACTIVE", createdAt: "2026-08-01 00:00:00" }],
      });
      const res = await request(app).get("/api/platform/dashboard/overview");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(expect.objectContaining({
        totalTenants: 10,
        incomeTrend: expect.any(Array),
        recentTenants: expect.any(Array),
      }));
    });
  });

  describe("GET /api/platform/tenants/usage-stats 与 /rank", () => {
    const app = createTestApp({ prefix: "/api/platform/tenants", router: platformTenantRouter });

    it("GET /usage-stats 应返回 overview/trendData/moduleUsage", async () => {
      (tenantUsageService.getUsageStats as any).mockResolvedValue({
        overview: { totalUsers: 10, totalOrders: 20, totalSales: 100, totalProducts: 5 },
        trendData: [{ period: "2026-08-01", value: 3 }],
        moduleUsage: [],
      });
      const res = await request(app).get("/api/platform/tenants/usage-stats?metric=order_count");
      expect(res.status).toBe(200);
      expect(res.body.data.overview.totalOrders).toBe(20);
      expect(tenantUsageService.getUsageStats).toHaveBeenCalledWith(expect.objectContaining({ metric: "order_count" }));
    });

    it("GET /rank 应返回数组（不被 /:id 捕获）", async () => {
      (tenantUsageService.getRank as any).mockResolvedValue([
        { tenantName: "测试租户", planName: "标准版", value: 10, percentage: 100, lastActive: "2026-08-01" },
      ]);
      const res = await request(app).get("/api/platform/tenants/rank?sortBy=order_count&limit=10");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(tenantUsageService.getRank).toHaveBeenCalledWith(expect.objectContaining({ sortBy: "order_count", limit: 10 }));
    });
  });

  describe("GET/PUT /api/platform/config/sys-config", () => {
    const app = createTestApp({ prefix: "/api/platform/config", router: platformConfigRouter });

    it("GET /sys-config 应返回平台系统设置对象", async () => {
      (sysConfigService.getSysConfig as any).mockResolvedValue({
        platformName: "智享全链",
        servicePhone: "400-000-0000",
        announcements: [],
      });
      const res = await request(app).get("/api/platform/config/sys-config");
      expect(res.status).toBe(200);
      expect(res.body.data.platformName).toBe("智享全链");
    });

    it("PUT /sys-config 应保存整包设置", async () => {
      (sysConfigService.updateSysConfig as any).mockResolvedValue({ updated: true });
      const res = await request(app)
        .put("/api/platform/config/sys-config")
        .send({ platformName: "智享全链", trialDays: 7 });
      expect(res.status).toBe(200);
      expect(sysConfigService.updateSysConfig).toHaveBeenCalledWith(
        expect.objectContaining({ platformName: "智享全链" }),
        "platform"
      );
    });
  });
});
