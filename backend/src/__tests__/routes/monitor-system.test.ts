import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/admin/system-monitor.service", () => ({
  getMemoryUsage: vi.fn(),
  getCpuUsage: vi.fn(),
  getProcessInfo: vi.fn(),
  getSystemHealth: vi.fn(),
}));

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

import * as systemMonitorService from "../../services/admin/system-monitor.service";
import { monitorSystemRouter } from "../../routes/monitor-system.routes";

const app = createTestApp({ prefix: "/api/monitor", router: monitorSystemRouter });

describe("routes/monitor-system 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /system", () => {
    it("应返回系统资源信息", async () => {
      (systemMonitorService.getMemoryUsage as any).mockReturnValue({ total: 16384, used: 8192 });
      (systemMonitorService.getCpuUsage as any).mockReturnValue({ usage: 45.5 });
      (systemMonitorService.getProcessInfo as any).mockReturnValue({ pid: 1234, uptime: 3600 });
      const res = await request(app).get("/api/monitor/system");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(systemMonitorService.getMemoryUsage).toHaveBeenCalled();
      expect(systemMonitorService.getCpuUsage).toHaveBeenCalled();
      expect(systemMonitorService.getProcessInfo).toHaveBeenCalled();
    });

    it("getMemoryUsage 抛错时返回500", async () => {
      (systemMonitorService.getMemoryUsage as any).mockImplementation(() => {
        throw new Error("memory error");
      });
      const res = await request(app).get("/api/monitor/system");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /health", () => {
    it("应返回综合健康检查结果", async () => {
      (systemMonitorService.getSystemHealth as any).mockResolvedValue({ status: "healthy" });
      const res = await request(app).get("/api/monitor/health");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(systemMonitorService.getSystemHealth).toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (systemMonitorService.getSystemHealth as any).mockRejectedValue(new Error("health error"));
      const res = await request(app).get("/api/monitor/health");
      expect(res.status).toBe(500);
    });
  });
});
