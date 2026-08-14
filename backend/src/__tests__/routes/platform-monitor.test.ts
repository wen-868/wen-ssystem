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

import { platformMonitorRouter } from "../../routes/platform-monitor.routes";

const app = createTestApp({ prefix: "/api/platform-monitor", router: platformMonitorRouter });

describe("routes/platform-monitor 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /", () => {
    it("应返回系统监控数据", async () => {
      const res = await request(app).get("/api/platform-monitor");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(res.body.data).toBeDefined();
      expect(res.body.data.uptime).toBeDefined();
      expect(res.body.data.memory).toBeDefined();
      expect(res.body.data.cpu).toBeDefined();
      expect(res.body.data.nodeVersion).toBeDefined();
      expect(res.body.data.platform).toBeDefined();
    });

    it("应包含 lastError（当 process._lastUncaughtError 存在时）", async () => {
      (process as any)._lastUncaughtError = new Error("test uncaught error");
      try {
        const res = await request(app).get("/api/platform-monitor");
        expect(res.status).toBe(200);
        expect(res.body.data.lastError).toContain("test uncaught error");
      } finally {
        delete (process as any)._lastUncaughtError;
      }
    });
  });
});
