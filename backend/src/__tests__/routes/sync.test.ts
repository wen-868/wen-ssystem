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

vi.mock("../../services/sync/delta-sync.service", () => ({
  getProductDelta: vi.fn(),
  getInventoryDelta: vi.fn(),
  getMemberDelta: vi.fn(),
  submitOfflineOrders: vi.fn(),
}));

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace" })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace" })),
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
import * as deltaSyncSvc from "../../services/sync/delta-sync.service";
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

  // ==================== R51-04 增量同步：商品 ====================
  describe("GET /products/delta", () => {
    it("应返回增量商品变更列表（默认分页）", async () => {
      const mockResult = {
        since: "1970-01-01T00:00:00Z",
        until: "2026-07-19T10:00:00Z",
        hasMore: false,
        changes: [
          {
            action: "UPSERT",
            skuId: 101,
            spuId: 11,
            data: { skuId: 101, spuId: 11, skuCode: "SKU001" },
          },
        ],
      };
      (deltaSyncSvc.getProductDelta as any).mockResolvedValue(mockResult);
      const res = await request(app).get("/api/sync/products/delta");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(deltaSyncSvc.getProductDelta).toHaveBeenCalledWith("", "test-tenant", 1, 100);
      expect(res.body.data).toEqual(mockResult);
    });

    it("应正确传递 since 和分页参数", async () => {
      (deltaSyncSvc.getProductDelta as any).mockResolvedValue({
        since: "2026-07-19T00:00:00Z",
        until: "2026-07-19T10:00:00Z",
        hasMore: true,
        changes: [],
      });
      const res = await request(app).get(
        "/api/sync/products/delta?since=2026-07-19T00:00:00Z&page=2&pageSize=50"
      );
      expect(res.status).toBe(200);
      expect(deltaSyncSvc.getProductDelta).toHaveBeenCalledWith(
        "2026-07-19T00:00:00Z",
        "test-tenant",
        2,
        50
      );
      expect(res.body.data.hasMore).toBe(true);
    });

    it("since 非法格式时返回 400", async () => {
      const res = await request(app).get("/api/sync/products/delta?since=invalid-date");
      expect(res.status).toBe(400);
      expect(deltaSyncSvc.getProductDelta).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (deltaSyncSvc.getProductDelta as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/sync/products/delta");
      expect(res.status).toBe(500);
    });
  });

  // ==================== R51-04 增量同步：库存 ====================
  describe("GET /inventory/delta", () => {
    it("应返回增量库存变更列表", async () => {
      const mockResult = {
        since: "1970-01-01T00:00:00Z",
        until: "2026-07-19T10:00:00Z",
        hasMore: false,
        changes: [
          {
            action: "UPSERT",
            skuId: 101,
            spuId: 0,
            data: { storeId: 1, skuId: 101, availableQty: 100 },
          },
        ],
      };
      (deltaSyncSvc.getInventoryDelta as any).mockResolvedValue(mockResult);
      const res = await request(app).get("/api/sync/inventory/delta");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(deltaSyncSvc.getInventoryDelta).toHaveBeenCalledWith("", "test-tenant", 1, 100);
      expect(res.body.data).toEqual(mockResult);
    });

    it("应正确传递 since 和分页参数", async () => {
      (deltaSyncSvc.getInventoryDelta as any).mockResolvedValue({
        since: "2026-07-19T00:00:00Z",
        until: "2026-07-19T10:00:00Z",
        hasMore: false,
        changes: [],
      });
      const res = await request(app).get(
        "/api/sync/inventory/delta?since=2026-07-19T00:00:00Z&page=3&pageSize=200"
      );
      expect(res.status).toBe(200);
      expect(deltaSyncSvc.getInventoryDelta).toHaveBeenCalledWith(
        "2026-07-19T00:00:00Z",
        "test-tenant",
        3,
        200
      );
    });

    it("since 非法格式时返回 400", async () => {
      const res = await request(app).get("/api/sync/inventory/delta?since=2026/07/19");
      expect(res.status).toBe(400);
      expect(deltaSyncSvc.getInventoryDelta).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (deltaSyncSvc.getInventoryDelta as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/sync/inventory/delta");
      expect(res.status).toBe(500);
    });
  });

  // ==================== R51-04 增量同步：客户 ====================
  describe("GET /members/delta", () => {
    it("应返回增量客户变更列表", async () => {
      const mockResult = {
        since: "1970-01-01T00:00:00Z",
        until: "2026-07-19T10:00:00Z",
        hasMore: false,
        changes: [
          {
            action: "UPSERT",
            skuId: 0,
            spuId: 0,
            data: { memberId: 1, name: "张三", mobile: "13800000000" },
          },
        ],
      };
      (deltaSyncSvc.getMemberDelta as any).mockResolvedValue(mockResult);
      const res = await request(app).get("/api/sync/members/delta");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(deltaSyncSvc.getMemberDelta).toHaveBeenCalledWith("", "test-tenant", 1, 100);
      expect(res.body.data).toEqual(mockResult);
    });

    it("应正确传递 since 和分页参数", async () => {
      (deltaSyncSvc.getMemberDelta as any).mockResolvedValue({
        since: "2026-07-19T00:00:00Z",
        until: "2026-07-19T10:00:00Z",
        hasMore: true,
        changes: [],
      });
      const res = await request(app).get(
        "/api/sync/members/delta?since=2026-07-19T00:00:00Z&page=1&pageSize=20"
      );
      expect(res.status).toBe(200);
      expect(deltaSyncSvc.getMemberDelta).toHaveBeenCalledWith(
        "2026-07-19T00:00:00Z",
        "test-tenant",
        1,
        20
      );
    });

    it("since 非法格式时返回 400", async () => {
      const res = await request(app).get("/api/sync/members/delta?since=not-a-date");
      expect(res.status).toBe(400);
      expect(deltaSyncSvc.getMemberDelta).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (deltaSyncSvc.getMemberDelta as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/sync/members/delta");
      expect(res.status).toBe(500);
    });
  });

  // ==================== R51-04 离线订单批量提交 ====================
  describe("POST /offline-orders", () => {
    it("应成功批量提交离线订单", async () => {
      const mockResult = {
        totalCount: 2,
        successCount: 2,
        failureCount: 0,
        results: [
          { draftNo: "D001", success: true, billNo: "B20260719001" },
          { draftNo: "D002", success: true, billNo: "B20260719002" },
        ],
      };
      (deltaSyncSvc.submitOfflineOrders as any).mockResolvedValue(mockResult);
      const orders = [
        {
          draftNo: "D001",
          items: [{ skuId: 1, skuName: "测试商品", totalBottleQty: 1, unitPrice: 10, subtotalAmount: 10 }],
          totalAmount: 10,
          createdAt: "2026-07-19T10:00:00Z",
        },
        {
          draftNo: "D002",
          items: [{ skuId: 2, skuName: "测试商品2", totalBottleQty: 2, unitPrice: 20, subtotalAmount: 40 }],
          totalAmount: 40,
          createdAt: "2026-07-19T10:01:00Z",
        },
      ];
      const res = await request(app).post("/api/sync/offline-orders").send({ orders });
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(deltaSyncSvc.submitOfflineOrders).toHaveBeenCalledWith(orders, "test-tenant", 1);
      expect(res.body.data.successCount).toBe(2);
    });

    it("orders 为空数组时返回 400", async () => {
      const res = await request(app).post("/api/sync/offline-orders").send({ orders: [] });
      expect(res.status).toBe(400);
      expect(deltaSyncSvc.submitOfflineOrders).not.toHaveBeenCalled();
    });

    it("orders 缺失时返回 400", async () => {
      const res = await request(app).post("/api/sync/offline-orders").send({});
      expect(res.status).toBe(400);
      expect(deltaSyncSvc.submitOfflineOrders).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (deltaSyncSvc.submitOfflineOrders as any).mockRejectedValue(new Error("tx error"));
      const res = await request(app).post("/api/sync/offline-orders").send({
        orders: [
          {
            draftNo: "D001",
            items: [{ skuId: 1, skuName: "x", totalBottleQty: 1, unitPrice: 1, subtotalAmount: 1 }],
            totalAmount: 1,
            createdAt: "2026-07-19T10:00:00Z",
          },
        ],
      });
      expect(res.status).toBe(500);
    });
  });
});
