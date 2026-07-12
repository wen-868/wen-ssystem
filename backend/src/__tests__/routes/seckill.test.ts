import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app.js";

vi.mock("../../services/admin/seckill.service.js", () => ({
  getSeckillProducts: vi.fn(),
  createSeckillProduct: vi.fn(),
  updateSeckillProduct: vi.fn(),
  deleteSeckillProduct: vi.fn(),
}));

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace", apiCost: 0 })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace", apiCost: 0 })),
}));

vi.mock("../../middleware/auth.js", () => ({
  requireAuthWithTenant: [],
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/tenant.js", () => ({
  tenantMiddleware: (_req: any, _res: any, next: any) => next(),
}));

import * as seckillService from "../../services/admin/seckill.service.js";
import { seckillRouter } from "../../routes/seckill.routes.js";

const app = createTestApp({
  prefix: "/api/seckill",
  router: seckillRouter,
});

describe("routes/seckill 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /", () => {
    it("应返回秒杀商品列表", async () => {
      (seckillService.getSeckillProducts as any).mockResolvedValue([]);
      const res = await request(app).get("/api/seckill");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(seckillService.getSeckillProducts).toHaveBeenCalledWith("test-tenant", {});
    });

    it("应传递 query 参数", async () => {
      (seckillService.getSeckillProducts as any).mockResolvedValue([]);
      const res = await request(app).get("/api/seckill?status=ACTIVE&page=2&pageSize=5");
      expect(res.status).toBe(200);
      expect(seckillService.getSeckillProducts).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ status: "ACTIVE", page: "2", pageSize: "5" })
      );
    });

    it("service 抛错时返回500", async () => {
      (seckillService.getSeckillProducts as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/seckill");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /", () => {
    it("应创建秒杀商品", async () => {
      (seckillService.createSeckillProduct as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .post("/api/seckill")
        .send({ name: "秒杀商品", seckillPrice: 9.9 });
      expect(res.status).toBe(200);
      expect(seckillService.createSeckillProduct).toHaveBeenCalledWith(
        expect.objectContaining({ name: "秒杀商品", seckillPrice: 9.9 })
      );
    });

    it("service 抛错时返回500", async () => {
      (seckillService.createSeckillProduct as any).mockRejectedValue(new Error("create error"));
      const res = await request(app)
        .post("/api/seckill")
        .send({ name: "测试" });
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /:id", () => {
    it("应更新秒杀商品", async () => {
      (seckillService.updateSeckillProduct as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .put("/api/seckill/1")
        .send({ name: "更新名称" });
      expect(res.status).toBe(200);
      expect(seckillService.updateSeckillProduct).toHaveBeenCalledWith(1, expect.objectContaining({ name: "更新名称" }));
    });

    it("service 抛错时返回500", async () => {
      (seckillService.updateSeckillProduct as any).mockRejectedValue(new Error("update error"));
      const res = await request(app)
        .put("/api/seckill/1")
        .send({ name: "更新" });
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /:id", () => {
    it("应删除秒杀商品", async () => {
      (seckillService.deleteSeckillProduct as any).mockResolvedValue({ id: 1 });
      const res = await request(app).delete("/api/seckill/1");
      expect(res.status).toBe(200);
      expect(seckillService.deleteSeckillProduct).toHaveBeenCalledWith(1);
    });

    it("service 抛错时返回500", async () => {
      (seckillService.deleteSeckillProduct as any).mockRejectedValue(new Error("delete error"));
      const res = await request(app).delete("/api/seckill/1");
      expect(res.status).toBe(500);
    });
  });
});
