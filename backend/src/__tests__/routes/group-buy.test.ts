import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/admin/group-buy.service", () => ({
  getGroupBuyActivities: vi.fn(),
  createGroupBuyActivity: vi.fn(),
  updateGroupBuyActivity: vi.fn(),
  deleteGroupBuyActivity: vi.fn(),
  getGroupBuyRecords: vi.fn(),
  getGroupBuyRecordDetail: vi.fn(),
  cancelGroupBuyRecord: vi.fn(),
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

import * as groupBuyService from "../../services/admin/group-buy.service";
import { groupBuyRouter } from "../../routes/group-buy.routes";

const app = createTestApp({
  prefix: "/api/group-buy",
  router: groupBuyRouter,
});

describe("routes/group-buy 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /activities", () => {
    it("应返回拼团活动列表", async () => {
      (groupBuyService.getGroupBuyActivities as any).mockResolvedValue([]);
      const res = await request(app).get("/api/group-buy/activities");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(groupBuyService.getGroupBuyActivities).toHaveBeenCalledWith("test-tenant", {});
    });

    it("应传递 query 参数", async () => {
      (groupBuyService.getGroupBuyActivities as any).mockResolvedValue([]);
      const res = await request(app).get("/api/group-buy/activities?status=ACTIVE&page=2&pageSize=5");
      expect(res.status).toBe(200);
      expect(groupBuyService.getGroupBuyActivities).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ status: "ACTIVE", page: "2", pageSize: "5" })
      );
    });

    it("service 抛错时返回500", async () => {
      (groupBuyService.getGroupBuyActivities as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/group-buy/activities");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /activities", () => {
    it("应创建拼团活动", async () => {
      (groupBuyService.createGroupBuyActivity as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .post("/api/group-buy/activities")
        .send({ name: "二人拼团", groupPrice: 9.9 });
      expect(res.status).toBe(200);
      expect(groupBuyService.createGroupBuyActivity).toHaveBeenCalledWith(
        expect.objectContaining({ name: "二人拼团", groupPrice: 9.9 })
      );
    });

    it("service 抛错时返回500", async () => {
      (groupBuyService.createGroupBuyActivity as any).mockRejectedValue(new Error("create error"));
      const res = await request(app)
        .post("/api/group-buy/activities")
        .send({ name: "测试" });
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /activities/:id", () => {
    it("应更新拼团活动", async () => {
      (groupBuyService.updateGroupBuyActivity as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .put("/api/group-buy/activities/1")
        .send({ name: "更新名称" });
      expect(res.status).toBe(200);
      expect(groupBuyService.updateGroupBuyActivity).toHaveBeenCalledWith(1, expect.objectContaining({ name: "更新名称" }));
    });

    it("service 抛错时返回500", async () => {
      (groupBuyService.updateGroupBuyActivity as any).mockRejectedValue(new Error("update error"));
      const res = await request(app)
        .put("/api/group-buy/activities/1")
        .send({ name: "更新" });
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /activities/:id", () => {
    it("应删除拼团活动", async () => {
      (groupBuyService.deleteGroupBuyActivity as any).mockResolvedValue({ id: 1 });
      const res = await request(app).delete("/api/group-buy/activities/1");
      expect(res.status).toBe(200);
      expect(groupBuyService.deleteGroupBuyActivity).toHaveBeenCalledWith(1);
    });

    it("service 抛错时返回500", async () => {
      (groupBuyService.deleteGroupBuyActivity as any).mockRejectedValue(new Error("delete error"));
      const res = await request(app).delete("/api/group-buy/activities/1");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /records", () => {
    it("应返回拼团记录列表", async () => {
      (groupBuyService.getGroupBuyRecords as any).mockResolvedValue([]);
      const res = await request(app).get("/api/group-buy/records");
      expect(res.status).toBe(200);
      expect(groupBuyService.getGroupBuyRecords).toHaveBeenCalledWith("test-tenant", {});
    });

    it("应传递 query 参数", async () => {
      (groupBuyService.getGroupBuyRecords as any).mockResolvedValue([]);
      const res = await request(app).get("/api/group-buy/records?status=SUCCESS&page=2&pageSize=5");
      expect(res.status).toBe(200);
      expect(groupBuyService.getGroupBuyRecords).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ status: "SUCCESS", page: "2", pageSize: "5" })
      );
    });

    it("service 抛错时返回500", async () => {
      (groupBuyService.getGroupBuyRecords as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/group-buy/records");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /records/:groupNo", () => {
    it("应返回拼团记录详情", async () => {
      (groupBuyService.getGroupBuyRecordDetail as any).mockResolvedValue({ id: 1 });
      const res = await request(app).get("/api/group-buy/records/GB20260701001");
      expect(res.status).toBe(200);
      expect(groupBuyService.getGroupBuyRecordDetail).toHaveBeenCalledWith("GB20260701001");
    });

    it("service 抛错时返回500", async () => {
      (groupBuyService.getGroupBuyRecordDetail as any).mockRejectedValue(new Error("not found"));
      const res = await request(app).get("/api/group-buy/records/GB20260701001");
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /records/:groupNo/cancel", () => {
    it("应取消拼团记录", async () => {
      (groupBuyService.cancelGroupBuyRecord as any).mockResolvedValue({ id: 1 });
      const res = await request(app).put("/api/group-buy/records/GB20260701001/cancel");
      expect(res.status).toBe(200);
      expect(groupBuyService.cancelGroupBuyRecord).toHaveBeenCalledWith("GB20260701001");
    });

    it("service 抛错时返回500", async () => {
      (groupBuyService.cancelGroupBuyRecord as any).mockRejectedValue(new Error("cancel error"));
      const res = await request(app).put("/api/group-buy/records/GB20260701001/cancel");
      expect(res.status).toBe(500);
    });
  });
});
