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

vi.mock("../../services/admin/monitor.service", () => ({
  getDbStatus: vi.fn(),
  getApiStats: vi.fn(),
  getExpiringTenants: vi.fn(),
  notifyExpiringTenants: vi.fn(),
}));

import * as monitorService from "../../services/admin/monitor.service";
import { platformMonitorRouter } from "../../routes/platform-monitor.routes";

const app = createTestApp({ prefix: "/api/platform/monitor", router: platformMonitorRouter });

describe("R97-01 平台监控扩展端点测试", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /db-status 应返回数据库状态", async () => {
    (monitorService.getDbStatus as any).mockResolvedValue({ connection: "connected", database: "liquor_inventory", uptime: 0, tableCount: 400 });
    const res = await request(app).get("/api/platform/monitor/db-status");
    expect(res.status).toBe(200);
    expect(res.body.data.connection).toBe("connected");
  });

  it("GET /api-stats 应返回 API 统计", async () => {
    (monitorService.getApiStats as any).mockResolvedValue({ totalRequests: 100, errorCount: 2, errorRate: 2 });
    const res = await request(app).get("/api/platform/monitor/api-stats");
    expect(res.status).toBe(200);
    expect(res.body.data.totalRequests).toBe(100);
  });

  it("GET /expiring-tenants 应传递 days 参数", async () => {
    (monitorService.getExpiringTenants as any).mockResolvedValue([]);
    const res = await request(app).get("/api/platform/monitor/expiring-tenants?days=30");
    expect(res.status).toBe(200);
    expect(monitorService.getExpiringTenants).toHaveBeenCalledWith(30);
  });

  it("POST /notify-expiring 应通知到期租户", async () => {
    (monitorService.notifyExpiringTenants as any).mockResolvedValue(3);
    const res = await request(app)
      .post("/api/platform/monitor/notify-expiring")
      .send({ tenantIds: [1, 2, 3] });
    expect(res.status).toBe(200);
    expect(res.body.data.notifiedCount).toBe(3);
    expect(monitorService.notifyExpiringTenants).toHaveBeenCalledWith([1, 2, 3]);
  });
});
