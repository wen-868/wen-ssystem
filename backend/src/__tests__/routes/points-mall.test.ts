import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/admin/points-mall.service", () => ({
  getPointsMallItems: vi.fn(),
  createPointsMallItem: vi.fn(),
  updatePointsMallItem: vi.fn(),
  deletePointsMallItem: vi.fn(),
  getPointsMallOrders: vi.fn(),
  deliverPointsMallOrder: vi.fn(),
  cancelPointsMallOrder: vi.fn(),
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

import * as pointsMallService from "../../services/admin/points-mall.service";
import { pointsMallRouter } from "../../routes/points-mall.routes";

const app = createTestApp({
  prefix: "/api/points-mall",
  router: pointsMallRouter,
});

describe("routes/points-mall 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /items", () => {
    it("应返回积分商城商品列表", async () => {
      (pointsMallService.getPointsMallItems as any).mockResolvedValue([]);
      const res = await request(app).get("/api/points-mall/items");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(pointsMallService.getPointsMallItems).toHaveBeenCalledWith("test-tenant", {});
    });

    it("应传递 query 参数", async () => {
      (pointsMallService.getPointsMallItems as any).mockResolvedValue([]);
      const res = await request(app).get("/api/points-mall/items?status=ON&page=2&pageSize=5");
      expect(res.status).toBe(200);
      expect(pointsMallService.getPointsMallItems).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ status: "ON", page: "2", pageSize: "5" })
      );
    });

    it("service 抛错时返回500", async () => {
      (pointsMallService.getPointsMallItems as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/points-mall/items");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /items", () => {
    it("应创建积分商城商品", async () => {
      (pointsMallService.createPointsMallItem as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .post("/api/points-mall/items")
        .send({ name: "兑换商品", pointsRequired: 100 });
      expect(res.status).toBe(200);
      expect(pointsMallService.createPointsMallItem).toHaveBeenCalledWith(
        expect.objectContaining({ name: "兑换商品", pointsRequired: 100 })
      );
    });

    it("service 抛错时返回500", async () => {
      (pointsMallService.createPointsMallItem as any).mockRejectedValue(new Error("create error"));
      const res = await request(app)
        .post("/api/points-mall/items")
        .send({ name: "测试" });
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /items/:id", () => {
    it("应更新积分商城商品", async () => {
      (pointsMallService.updatePointsMallItem as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .put("/api/points-mall/items/1")
        .send({ name: "更新名称" });
      expect(res.status).toBe(200);
      expect(pointsMallService.updatePointsMallItem).toHaveBeenCalledWith(1, expect.objectContaining({ name: "更新名称" }));
    });

    it("service 抛错时返回500", async () => {
      (pointsMallService.updatePointsMallItem as any).mockRejectedValue(new Error("update error"));
      const res = await request(app)
        .put("/api/points-mall/items/1")
        .send({ name: "更新" });
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /items/:id", () => {
    it("应删除积分商城商品", async () => {
      (pointsMallService.deletePointsMallItem as any).mockResolvedValue({ id: 1 });
      const res = await request(app).delete("/api/points-mall/items/1");
      expect(res.status).toBe(200);
      expect(pointsMallService.deletePointsMallItem).toHaveBeenCalledWith(1);
    });

    it("service 抛错时返回500", async () => {
      (pointsMallService.deletePointsMallItem as any).mockRejectedValue(new Error("delete error"));
      const res = await request(app).delete("/api/points-mall/items/1");
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /items/:id/status", () => {
    it("应更新积分商城商品状态", async () => {
      (pointsMallService.updatePointsMallItem as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .put("/api/points-mall/items/1/status")
        .send({ status: "OFF" });
      expect(res.status).toBe(200);
      expect(pointsMallService.updatePointsMallItem).toHaveBeenCalledWith(1, expect.objectContaining({ status: "OFF" }));
    });

    it("service 抛错时返回500", async () => {
      (pointsMallService.updatePointsMallItem as any).mockRejectedValue(new Error("update error"));
      const res = await request(app)
        .put("/api/points-mall/items/1/status")
        .send({ status: "OFF" });
      expect(res.status).toBe(500);
    });
  });

  describe("GET /orders", () => {
    it("应返回积分商城订单列表", async () => {
      (pointsMallService.getPointsMallOrders as any).mockResolvedValue([]);
      const res = await request(app).get("/api/points-mall/orders");
      expect(res.status).toBe(200);
      expect(pointsMallService.getPointsMallOrders).toHaveBeenCalledWith("test-tenant", {});
    });

    it("应传递 query 参数", async () => {
      (pointsMallService.getPointsMallOrders as any).mockResolvedValue([]);
      const res = await request(app).get("/api/points-mall/orders?status=PENDING&page=2&pageSize=5");
      expect(res.status).toBe(200);
      expect(pointsMallService.getPointsMallOrders).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ status: "PENDING", page: "2", pageSize: "5" })
      );
    });

    it("service 抛错时返回500", async () => {
      (pointsMallService.getPointsMallOrders as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/points-mall/orders");
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /orders/:id/deliver", () => {
    it("应发货积分商城订单", async () => {
      (pointsMallService.deliverPointsMallOrder as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .put("/api/points-mall/orders/1/deliver")
        .send({ trackingNo: "SF12345" });
      expect(res.status).toBe(200);
      expect(pointsMallService.deliverPointsMallOrder).toHaveBeenCalledWith(1, expect.objectContaining({ trackingNo: "SF12345" }));
    });

    it("service 抛错时返回500", async () => {
      (pointsMallService.deliverPointsMallOrder as any).mockRejectedValue(new Error("deliver error"));
      const res = await request(app)
        .put("/api/points-mall/orders/1/deliver")
        .send({ trackingNo: "SF12345" });
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /orders/:id/cancel", () => {
    it("应取消积分商城订单", async () => {
      (pointsMallService.cancelPointsMallOrder as any).mockResolvedValue({ id: 1 });
      const res = await request(app).put("/api/points-mall/orders/1/cancel");
      expect(res.status).toBe(200);
      expect(pointsMallService.cancelPointsMallOrder).toHaveBeenCalledWith(1);
    });

    it("service 抛错时返回500", async () => {
      (pointsMallService.cancelPointsMallOrder as any).mockRejectedValue(new Error("cancel error"));
      const res = await request(app).put("/api/points-mall/orders/1/cancel");
      expect(res.status).toBe(500);
    });
  });
});
