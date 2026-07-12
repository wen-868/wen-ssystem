import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/sync/price-sync.service", () => ({
  getChangesSince: vi.fn(),
  getPricesByIds: vi.fn(),
  syncPrices: vi.fn(),
  getSyncStatus: vi.fn(),
  getLastSyncTime: vi.fn(),
}));

vi.mock("../../services/sync/product-sync.service", () => ({
  syncProducts: vi.fn(),
}));

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace", apiCost: 0 })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace", apiCost: 0 })),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuthWithTenant: [],
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
  requirePlatformAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/tenant", () => ({
  tenantMiddleware: (_req: any, _res: any, next: any) => next(),
  getTenantId: (req: any) => req.tenantId || "default",
}));

import * as priceSyncSvc from "../../services/sync/price-sync.service";
import * as productSyncSvc from "../../services/sync/product-sync.service";
import syncRouter from "../../routes/sync.routes";

const app = createTestApp({ prefix: "/api/sync", router: syncRouter as any });

describe("routes/sync 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  // ==================== 价格同步 ====================
  describe("GET /check", () => {
    it("应返回价格变更列表", async () => {
      (priceSyncSvc.getChangesSince as any).mockResolvedValue({ changes: [] });
      const res = await request(app).get("/api/sync/check?since=20260101");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(priceSyncSvc.getChangesSince).toHaveBeenCalledWith("test-tenant", "20260101");
    });

    it("无 since 参数时传 undefined", async () => {
      (priceSyncSvc.getChangesSince as any).mockResolvedValue({ changes: [] });
      const res = await request(app).get("/api/sync/check");
      expect(res.status).toBe(200);
      expect(priceSyncSvc.getChangesSince).toHaveBeenCalledWith("test-tenant", undefined);
    });

    it("service 抛错时返回500", async () => {
      (priceSyncSvc.getChangesSince as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/sync/check");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /prices", () => {
    it("应返回批量价格", async () => {
      (priceSyncSvc.getPricesByIds as any).mockResolvedValue([{ skuId: 1, price: 100 }]);
      const res = await request(app).get("/api/sync/prices?ids=1,2,3");
      expect(res.status).toBe(200);
      expect(priceSyncSvc.getPricesByIds).toHaveBeenCalledWith("test-tenant", [1, 2, 3]);
    });

    it("无 ids 参数时传空数组", async () => {
      (priceSyncSvc.getPricesByIds as any).mockResolvedValue([]);
      const res = await request(app).get("/api/sync/prices");
      expect(res.status).toBe(200);
      expect(priceSyncSvc.getPricesByIds).toHaveBeenCalledWith("test-tenant", []);
    });

    it("service 抛错时返回500", async () => {
      (priceSyncSvc.getPricesByIds as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/sync/prices");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /price", () => {
    it("应全量同步价格", async () => {
      (priceSyncSvc.syncPrices as any).mockResolvedValue({ synced: 10 });
      const res = await request(app)
        .post("/api/sync/price")
        .send({ skuIds: [1, 2] });
      expect(res.status).toBe(200);
      expect(priceSyncSvc.syncPrices).toHaveBeenCalledWith("test-tenant", [1, 2]);
    });

    it("无 skuIds 时传 undefined", async () => {
      (priceSyncSvc.syncPrices as any).mockResolvedValue({ synced: 0 });
      const res = await request(app)
        .post("/api/sync/price")
        .send({});
      expect(res.status).toBe(200);
      expect(priceSyncSvc.syncPrices).toHaveBeenCalledWith("test-tenant", undefined);
    });

    it("service 抛错时返回500", async () => {
      (priceSyncSvc.syncPrices as any).mockRejectedValue(new Error("sync error"));
      const res = await request(app)
        .post("/api/sync/price")
        .send({});
      expect(res.status).toBe(500);
    });
  });

  describe("GET /price/status", () => {
    it("应返回价格同步状态", async () => {
      (priceSyncSvc.getSyncStatus as any).mockResolvedValue({ status: "idle" });
      const res = await request(app).get("/api/sync/price/status");
      expect(res.status).toBe(200);
      expect(priceSyncSvc.getSyncStatus).toHaveBeenCalledWith("test-tenant", "price");
    });

    it("service 抛错时返回500", async () => {
      (priceSyncSvc.getSyncStatus as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/sync/price/status");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /price/last", () => {
    it("应返回价格最后同步时间", async () => {
      (priceSyncSvc.getLastSyncTime as any).mockResolvedValue({ lastSync: "2026-01-01" });
      const res = await request(app).get("/api/sync/price/last");
      expect(res.status).toBe(200);
      expect(priceSyncSvc.getLastSyncTime).toHaveBeenCalledWith("test-tenant", "price");
    });

    it("service 抛错时返回500", async () => {
      (priceSyncSvc.getLastSyncTime as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/sync/price/last");
      expect(res.status).toBe(500);
    });
  });

  // ==================== 商品同步 ====================
  describe("POST /product", () => {
    it("应全量同步商品", async () => {
      (productSyncSvc.syncProducts as any).mockResolvedValue({ synced: 5 });
      const res = await request(app)
        .post("/api/sync/product")
        .send({ spuIds: [1, 2] });
      expect(res.status).toBe(200);
      expect(productSyncSvc.syncProducts).toHaveBeenCalledWith("test-tenant", [1, 2]);
    });

    it("无 spuIds 时传 undefined", async () => {
      (productSyncSvc.syncProducts as any).mockResolvedValue({ synced: 0 });
      const res = await request(app)
        .post("/api/sync/product")
        .send({});
      expect(res.status).toBe(200);
      expect(productSyncSvc.syncProducts).toHaveBeenCalledWith("test-tenant", undefined);
    });

    it("service 抛错时返回500", async () => {
      (productSyncSvc.syncProducts as any).mockRejectedValue(new Error("sync error"));
      const res = await request(app)
        .post("/api/sync/product")
        .send({});
      expect(res.status).toBe(500);
    });
  });

  describe("GET /product/status", () => {
    it("应返回商品同步状态", async () => {
      (priceSyncSvc.getSyncStatus as any).mockResolvedValue({ status: "idle" });
      const res = await request(app).get("/api/sync/product/status");
      expect(res.status).toBe(200);
      expect(priceSyncSvc.getSyncStatus).toHaveBeenCalledWith("test-tenant", "product");
    });

    it("service 抛错时返回500", async () => {
      (priceSyncSvc.getSyncStatus as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/sync/product/status");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /product/last", () => {
    it("应返回商品最后同步时间", async () => {
      (priceSyncSvc.getLastSyncTime as any).mockResolvedValue({ lastSync: "2026-01-01" });
      const res = await request(app).get("/api/sync/product/last");
      expect(res.status).toBe(200);
      expect(priceSyncSvc.getLastSyncTime).toHaveBeenCalledWith("test-tenant", "product");
    });

    it("service 抛错时返回500", async () => {
      (priceSyncSvc.getLastSyncTime as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/sync/product/last");
      expect(res.status).toBe(500);
    });
  });
});
