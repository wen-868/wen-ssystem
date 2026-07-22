import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/admin/purchase-plan.service", () => ({
  suggestPurchasePlan: vi.fn(),
  createPurchasePlan: vi.fn(),
  listPurchasePlans: vi.fn(),
  convertPurchasePlan: vi.fn(),
}));

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace" })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace" })),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuthWithTenant: [],
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/tenant", () => ({
  tenantMiddleware: (_req: any, _res: any, next: any) => next(),
}));

import * as purchasePlanService from "../../services/admin/purchase-plan.service";
import { purchasePlanRouter } from "../../routes/purchase-plan.routes";

const app = createTestApp({
  prefix: "/api/admin/purchase-plans",
  router: purchasePlanRouter,
});

describe("routes/purchase-plan 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /suggest", () => {
    it("应返回采购计划建议", async () => {
      (purchasePlanService.suggestPurchasePlan as any).mockResolvedValue({ items: [] });
      const res = await request(app).get("/api/admin/purchase-plans/suggest");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(purchasePlanService.suggestPurchasePlan).toHaveBeenCalledWith("test-tenant", undefined);
    });

    it("应传递 storeId 参数", async () => {
      (purchasePlanService.suggestPurchasePlan as any).mockResolvedValue({ items: [] });
      const res = await request(app).get("/api/admin/purchase-plans/suggest?storeId=2");
      expect(res.status).toBe(200);
      expect(purchasePlanService.suggestPurchasePlan).toHaveBeenCalledWith("test-tenant", 2);
    });

    it("service 抛错时返回错误", async () => {
      (purchasePlanService.suggestPurchasePlan as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/admin/purchase-plans/suggest");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /", () => {
    it("应创建采购计划", async () => {
      (purchasePlanService.createPurchasePlan as any).mockResolvedValue({ planNo: "PL001" });
      const res = await request(app)
        .post("/api/admin/purchase-plans")
        .send({ supplierId: 1, storeId: 1, items: [{ skuId: 1, quantity: 10 }] });
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(purchasePlanService.createPurchasePlan).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierId: 1,
          storeId: 1,
          tenantId: "test-tenant",
        })
      );
    });

    it("service 抛错时返回错误", async () => {
      (purchasePlanService.createPurchasePlan as any).mockRejectedValue(new Error("create error"));
      const res = await request(app)
        .post("/api/admin/purchase-plans")
        .send({ supplierId: 1 });
      expect(res.status).toBe(500);
    });
  });

  describe("GET /", () => {
    it("应返回采购计划列表", async () => {
      (purchasePlanService.listPurchasePlans as any).mockResolvedValue({ total: 0, records: [] });
      const res = await request(app).get("/api/admin/purchase-plans?page=1&pageSize=20");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(purchasePlanService.listPurchasePlans).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 20,
          tenantId: "test-tenant",
        })
      );
    });

    it("应使用默认分页参数", async () => {
      (purchasePlanService.listPurchasePlans as any).mockResolvedValue({ total: 0, records: [] });
      const res = await request(app).get("/api/admin/purchase-plans");
      expect(res.status).toBe(200);
      expect(purchasePlanService.listPurchasePlans).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 20,
        })
      );
    });
  });

  describe("POST /:planNo/convert", () => {
    it("应转换采购计划", async () => {
      (purchasePlanService.convertPurchasePlan as any).mockResolvedValue({ orderNo: "PO001" });
      const res = await request(app).post("/api/admin/purchase-plans/PL001/convert");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(purchasePlanService.convertPurchasePlan).toHaveBeenCalledWith("PL001", "test-tenant");
    });

    it("service 抛错时返回错误", async () => {
      (purchasePlanService.convertPurchasePlan as any).mockRejectedValue(new Error("convert error"));
      const res = await request(app).post("/api/admin/purchase-plans/PL001/convert");
      expect(res.status).toBe(500);
    });
  });
});
