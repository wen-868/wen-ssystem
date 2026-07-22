import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/store/product.service", () => ({
  listProducts: vi.fn(),
  listMembers: vi.fn(),
  getCategories: vi.fn(),
  getProductDetail: vi.fn(),
}));

vi.mock("../../services/admin/tag.service", () => ({
  listGroups: vi.fn(),
  listTags: vi.fn(),
  getProductTags: vi.fn(),
}));

vi.mock("../../services/admin/inventory-batch.service", () => ({
  listBatches: vi.fn(),
  getBatchDetail: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  transaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../shared/price-guard", () => ({
  canAccessPriceField: vi.fn().mockReturnValue(true),
  canAccessPriceLevel: vi.fn().mockResolvedValue(true),
  logUnauthorizedAccess: vi.fn().mockResolvedValue(undefined),
  filterPriceFields: vi.fn((user: any, data: any) => ({ filtered: data, blocked: [] })),
  filterPriceFieldsBatch: vi.fn((user: any, data: any) => ({ filtered: data, blocked: [] })),
}));

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data: any) => ({ code: "0", msg: "成功", data, traceId: "test-trace" })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg, traceId: "test-trace" })),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuthWithTenant: (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
  requirePlatformAuth: (_req: any, _res: any, next: any) => next(),
  getUserAccessInfo: vi.fn().mockReturnValue({ accessModes: ["ADMIN", "CASHIER"], defaultMode: "ADMIN" }),
  signToken: vi.fn().mockReturnValue("fake-token"),
}));

vi.mock("../../middleware/tenant", () => ({
  tenantMiddleware: (_req: any, _res: any, next: any) => next(),
  getTenantId: (req: any) => req.tenantId || "default",
}));

import * as productService from "../../services/store/product.service";
import * as tagService from "../../services/admin/tag.service";
import * as batchService from "../../services/admin/inventory-batch.service";
import { storeRouter } from "../../routes/store.routes";

const app = createTestApp({ prefix: "/api/store", router: storeRouter });

describe("routes/store 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  // R47-05 清理后，store.routes.ts 只保留商品/标签/批次路由
  // /me、/info、/orders、/sale-bills、/inventory 等已迁移到独立路由文件

  describe("GET /products", () => {
    it("应返回产品列表", async () => {
      (productService.listProducts as any).mockResolvedValue({ list: [], total: 0 });
      const res = await request(app).get("/api/store/products?keyword=测试");
      expect(res.status).toBe(200);
      expect(productService.listProducts).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: "测试", tenantId: "test-tenant" })
      );
    });

    it("service 抛错时返回500", async () => {
      (productService.listProducts as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/store/products");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /product-categories", () => {
    it("应返回分类列表", async () => {
      (productService.getCategories as any).mockResolvedValue([{ id: 1 }]);
      const res = await request(app).get("/api/store/product-categories");
      expect(res.status).toBe(200);
      expect(productService.getCategories).toHaveBeenCalledWith("test-tenant");
    });
  });

  describe("GET /products/:spuId", () => {
    it("应返回产品详情", async () => {
      (productService.getProductDetail as any).mockResolvedValue({ id: 1 });
      const res = await request(app).get("/api/store/products/1");
      expect(res.status).toBe(200);
      expect(productService.getProductDetail).toHaveBeenCalledWith(1, "test-tenant");
    });

    it("service 抛错时返回500", async () => {
      (productService.getProductDetail as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/store/products/1");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /members", () => {
    it("应返回会员列表", async () => {
      (productService.listMembers as any).mockResolvedValue([{ id: 1 }]);
      const res = await request(app).get("/api/store/members?keyword=张");
      expect(res.status).toBe(200);
      expect(productService.listMembers).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: "张", tenantId: "test-tenant" })
      );
    });
  });

  describe("GET /tags", () => {
    it("应返回标签列表", async () => {
      (tagService.listTags as any).mockResolvedValue([{ id: 1 }]);
      const res = await request(app).get("/api/store/tags");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /tag-groups", () => {
    it("应返回标签组列表", async () => {
      (tagService.listGroups as any).mockResolvedValue([{ id: 1 }]);
      const res = await request(app).get("/api/store/tag-groups");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /batches/:id", () => {
    it("应返回批次详情", async () => {
      (batchService.getBatchDetail as any).mockResolvedValue({ id: 1 });
      const res = await request(app).get("/api/store/batches/1");
      expect(res.status).toBe(200);
    });

    it("批次不存在时返回404", async () => {
      (batchService.getBatchDetail as any).mockResolvedValue(null);
      const res = await request(app).get("/api/store/batches/1");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /batches/:id/trace", () => {
    it("应返回批次追溯链", async () => {
      (batchService.getBatchDetail as any).mockResolvedValue({ id: 1 });
      const res = await request(app).get("/api/store/batches/1/trace");
      expect(res.status).toBe(200);
    });

    it("批次不存在时返回404", async () => {
      (batchService.getBatchDetail as any).mockResolvedValue(null);
      const res = await request(app).get("/api/store/batches/1/trace");
      expect(res.status).toBe(404);
    });
  });
});
