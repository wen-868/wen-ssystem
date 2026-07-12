import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/admin/miniapp-order-sync.service", () => ({
  listSyncLogs: vi.fn(),
  retrySync: vi.fn(),
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

vi.mock("../../middleware/tenant", () => ({
  tenantMiddleware: (_req: any, _res: any, next: any) => next(),
}));

import * as syncLogService from "../../services/admin/miniapp-order-sync.service";
import { orderSyncLogRouter } from "../../routes/miniapp-order-sync.routes";

const app = createTestApp({ prefix: "/api/miniapp-order-sync", router: orderSyncLogRouter });

describe("routes/miniapp-order-sync 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /", () => {
    it("应返回同步日志列表", async () => {
      (syncLogService.listSyncLogs as any).mockResolvedValue({ records: [], total: 0 });
      const res = await request(app).get("/api/miniapp-order-sync");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(syncLogService.listSyncLogs).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ page: 1, pageSize: 20 })
      );
    });

    it("应传递筛选参数", async () => {
      (syncLogService.listSyncLogs as any).mockResolvedValue({ records: [], total: 0 });
      const res = await request(app).get("/api/miniapp-order-sync?orderNo=ORD001&status=1&page=2&pageSize=10");
      expect(res.status).toBe(200);
      expect(syncLogService.listSyncLogs).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ orderNo: "ORD001", status: 1, page: 2, pageSize: 10 })
      );
    });

    it("service 抛错时返回500", async () => {
      (syncLogService.listSyncLogs as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/miniapp-order-sync");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /:orderNo/retry", () => {
    it("应重试同步", async () => {
      (syncLogService.retrySync as any).mockResolvedValue({ success: true });
      const res = await request(app).post("/api/miniapp-order-sync/ORD001/retry");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(syncLogService.retrySync).toHaveBeenCalledWith("test-tenant", "ORD001");
    });

    it("service 抛错时返回500", async () => {
      (syncLogService.retrySync as any).mockRejectedValue(new Error("retry error"));
      const res = await request(app).post("/api/miniapp-order-sync/ORD001/retry");
      expect(res.status).toBe(500);
    });
  });
});
