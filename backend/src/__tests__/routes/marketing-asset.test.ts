import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/admin/marketing-asset.service", () => ({
  getMarketingAssets: vi.fn(),
  createMarketingAsset: vi.fn(),
  updateMarketingAsset: vi.fn(),
  deleteMarketingAsset: vi.fn(),
}));

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace", apiCost: 0 })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace", apiCost: 0 })),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuthWithTenant: [],
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/tenant", () => ({
  tenantMiddleware: (_req: any, _res: any, next: any) => next(),
}));

import * as marketingAssetService from "../../services/admin/marketing-asset.service";
import { marketingAssetRouter } from "../../routes/marketing-asset.routes";

const app = createTestApp({
  prefix: "/api/admin/marketing-assets",
  router: marketingAssetRouter,
});

describe("routes/marketing-asset 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /", () => {
    it("应返回营销资产列表", async () => {
      (marketingAssetService.getMarketingAssets as any).mockResolvedValue([]);
      const res = await request(app).get("/api/admin/marketing-assets");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(marketingAssetService.getMarketingAssets).toHaveBeenCalledWith("test-tenant", {});
    });

    it("应传递 query 参数", async () => {
      (marketingAssetService.getMarketingAssets as any).mockResolvedValue([]);
      const res = await request(app).get("/api/admin/marketing-assets?type=IMAGE&status=ACTIVE");
      expect(res.status).toBe(200);
      expect(marketingAssetService.getMarketingAssets).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ type: "IMAGE", status: "ACTIVE" })
      );
    });

    it("service 抛错时返回500", async () => {
      (marketingAssetService.getMarketingAssets as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/admin/marketing-assets");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /", () => {
    it("应创建营销资产", async () => {
      (marketingAssetService.createMarketingAsset as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .post("/api/admin/marketing-assets")
        .send({ name: "测试资产", type: "IMAGE" });
      expect(res.status).toBe(200);
      expect(marketingAssetService.createMarketingAsset).toHaveBeenCalledWith(
        expect.objectContaining({ name: "测试资产", type: "IMAGE" })
      );
    });

    it("service 抛错时返回500", async () => {
      (marketingAssetService.createMarketingAsset as any).mockRejectedValue(new Error("create error"));
      const res = await request(app)
        .post("/api/admin/marketing-assets")
        .send({ name: "测试" });
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /:id", () => {
    it("应更新营销资产", async () => {
      (marketingAssetService.updateMarketingAsset as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .put("/api/admin/marketing-assets/1")
        .send({ name: "更新名称" });
      expect(res.status).toBe(200);
      expect(marketingAssetService.updateMarketingAsset).toHaveBeenCalledWith(1, expect.objectContaining({ name: "更新名称" }));
    });

    it("service 抛错时返回500", async () => {
      (marketingAssetService.updateMarketingAsset as any).mockRejectedValue(new Error("update error"));
      const res = await request(app)
        .put("/api/admin/marketing-assets/1")
        .send({ name: "更新" });
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /:id", () => {
    it("应删除营销资产", async () => {
      (marketingAssetService.deleteMarketingAsset as any).mockResolvedValue({ id: 1 });
      const res = await request(app).delete("/api/admin/marketing-assets/1");
      expect(res.status).toBe(200);
      expect(marketingAssetService.deleteMarketingAsset).toHaveBeenCalledWith(1);
    });

    it("service 抛错时返回500", async () => {
      (marketingAssetService.deleteMarketingAsset as any).mockRejectedValue(new Error("delete error"));
      const res = await request(app).delete("/api/admin/marketing-assets/1");
      expect(res.status).toBe(500);
    });
  });
});
