import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/admin/platform-review.service", () => ({
  listReviews: vi.fn(),
  getStats: vi.fn(),
  replyReview: vi.fn(),
  getReviewById: vi.fn(),
}));

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace" })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace" })),
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

import * as reviewService from "../../services/admin/platform-review.service";
import { platformReviewRouter } from "../../routes/platform-review.routes";

const app = createTestApp({ prefix: "/api/platform-review", router: platformReviewRouter });

describe("routes/platform-review 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /", () => {
    it("应返回审核列表（不传租户：t_platform_review 是平台级表）", async () => {
      (reviewService.listReviews as any).mockResolvedValue({ records: [], total: 0, page: 1, pageSize: 20 });
      const res = await request(app).get("/api/platform-review");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(reviewService.listReviews).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 20 })
      );
      // 只允许一个入参对象：不得再把 tenantId 当第一参数传下去（平台级语义）
      expect((reviewService.listReviews as any).mock.calls[0]).toHaveLength(1);
    });

    it("空表（0 行）返回 200 且结构为 { total, page, pageSize, records }", async () => {
      (reviewService.listReviews as any).mockResolvedValue({ records: [], total: 0, page: 1, pageSize: 20 });
      const res = await request(app).get("/api/platform-review");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ records: [], total: 0, page: 1, pageSize: 20 });
    });

    it("应传递真实列筛选参数（platform / rating）", async () => {
      (reviewService.listReviews as any).mockResolvedValue({ records: [], total: 0 });
      const res = await request(app).get("/api/platform-review?platform=JD&rating=5&page=2&pageSize=10");
      expect(res.status).toBe(200);
      expect(reviewService.listReviews).toHaveBeenCalledWith(
        expect.objectContaining({ platform: "JD", rating: 5, page: 2, pageSize: 10 })
      );
    });

    it("service 抛错时返回500", async () => {
      (reviewService.listReviews as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/platform-review");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /stats", () => {
    it("空表返回 200 且结构为 { stats: [] }", async () => {
      (reviewService.getStats as any).mockResolvedValue({ stats: [] });
      const res = await request(app).get("/api/platform-review/stats");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(res.body.data).toEqual({ stats: [] });
      // 平台级聚合，无入参（不传租户）
      expect(reviewService.getStats).toHaveBeenCalledWith();
    });

    it("service 抛错时返回500", async () => {
      (reviewService.getStats as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/platform-review/stats");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /:id/reply", () => {
    it("应回复审核", async () => {
      (reviewService.replyReview as any).mockResolvedValue({ id: 1, success: true });
      const res = await request(app)
        .post("/api/platform-review/1/reply")
        .send({ replyContent: "回复内容" });
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(reviewService.replyReview).toHaveBeenCalledWith(1, "回复内容");
    });

    it("replyContent 缺失时 zod 校验失败返回400", async () => {
      const res = await request(app)
        .post("/api/platform-review/1/reply")
        .send({});
      expect(res.status).toBe(400);
      expect(reviewService.replyReview).not.toHaveBeenCalled();
    });

    it("replyContent 为空字符串时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/platform-review/1/reply")
        .send({ replyContent: "" });
      expect(res.status).toBe(400);
      expect(reviewService.replyReview).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (reviewService.replyReview as any).mockRejectedValue(new Error("reply error"));
      const res = await request(app)
        .post("/api/platform-review/1/reply")
        .send({ replyContent: "回复" });
      expect(res.status).toBe(500);
    });
  });

  describe("GET /:id", () => {
    it("应返回评价详情", async () => {
      (reviewService.getReviewById as any).mockResolvedValue(null);
      const res = await request(app).get("/api/platform-review/12");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(reviewService.getReviewById).toHaveBeenCalledWith(12);
    });
  });

  describe("评价审核（真实表无审核状态载体）", () => {
    it("PUT /:id/approval 明确 501，不写库、不造假成功", async () => {
      const res = await request(app)
        .put("/api/platform-review/1/approval")
        .send({ status: 1 });
      expect(res.status).toBe(501);
      expect(res.body.code).toBe("501");
      expect(res.body.msg).toContain("无审核状态字段");
    });

    it("POST /batch-approval 明确 501，不写库、不造假成功", async () => {
      const res = await request(app)
        .post("/api/platform-review/batch-approval")
        .send({ ids: [1, 2], status: 1 });
      expect(res.status).toBe(501);
      expect(res.body.code).toBe("501");
      expect(res.body.msg).toContain("无审核状态字段");
    });
  });
});
