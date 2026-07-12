import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../middleware/slow-query-monitor", () => ({
  getSlowQueries: vi.fn(),
}));

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace", apiCost: 0 })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace", apiCost: 0 })),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuthWithTenant: (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
  requirePlatformAuth: (_req: any, _res: any, next: any) => next(),
}));

import { getSlowQueries } from "../../middleware/slow-query-monitor";
import { monitorSlowQueryRouter } from "../../routes/monitor-slow-query.routes";

const app = createTestApp({ prefix: "/api/monitor", router: monitorSlowQueryRouter });

describe("routes/monitor-slow-query 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /slow-queries", () => {
    it("应返回慢查询列表", async () => {
      const mockQueries = [
        { id: 1, sql: "SELECT * FROM orders", duration: 2500 },
        { id: 2, sql: "SELECT * FROM products", duration: 1800 },
      ];
      (getSlowQueries as any).mockReturnValue(mockQueries);
      const res = await request(app).get("/api/monitor/slow-queries");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.items).toEqual(mockQueries);
      expect(getSlowQueries).toHaveBeenCalled();
    });

    it("无慢查询时返回空列表", async () => {
      (getSlowQueries as any).mockReturnValue([]);
      const res = await request(app).get("/api/monitor/slow-queries");
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.items).toEqual([]);
    });

    it("getSlowQueries 抛错时返回500", async () => {
      (getSlowQueries as any).mockImplementation(() => {
        throw new Error("slow query error");
      });
      const res = await request(app).get("/api/monitor/slow-queries");
      expect(res.status).toBe(500);
    });
  });
});
