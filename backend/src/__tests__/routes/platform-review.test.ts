import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/admin/platform-review.service", () => ({
  listReviews: vi.fn(),
  getStats: vi.fn(),
  replyReview: vi.fn(),
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

import * as reviewService from "../../services/admin/platform-review.service";
import { platformReviewRouter } from "../../routes/platform-review.routes";

const app = createTestApp({ prefix: "/api/platform-review", router: platformReviewRouter });

describe("routes/platform-review 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /", () => {
    it("应返回审核列表", async () => {
      (reviewService.listReviews as any).mockResolvedValue({ records: [], total: 0 });
      const res = await request(app).get("/api/platform-review");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(reviewService.listReviews).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ page: 1, pageSize: 20 })
      );
    });

    it("应传递筛选参数", async () => {
      (reviewService.listReviews as any).mockResolvedValue({ records: [], total: 0 });
      const res = await request(app).get("/api/platform-review?platformName=JD&reviewType=1&status=0&page=2&pageSize=10");
      expect(res.status).toBe(200);
      expect(reviewService.listReviews).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ platformName: "JD", reviewType: 1, status: 0, page: 2, pageSize: 10 })
      );
    });

    it("service 抛错时返回500", async () => {
      (reviewService.listReviews as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/platform-review");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /stats", () => {
    it("应返回审核统计", async () => {
      (reviewService.getStats as any).mockResolvedValue({ total: 10, pending: 5 });
      const res = await request(app).get("/api/platform-review/stats");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(reviewService.getStats).toHaveBeenCalledWith("test-tenant");
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
      expect(reviewService.replyReview).toHaveBeenCalledWith("test-tenant", 1, "回复内容");
    });

    it("replyContent 缺失时 zod 校验失败返回500", async () => {
      const res = await request(app)
        .post("/api/platform-review/1/reply")
        .send({});
      expect(res.status).toBe(500);
      expect(reviewService.replyReview).not.toHaveBeenCalled();
    });

    it("replyContent 为空字符串时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/platform-review/1/reply")
        .send({ replyContent: "" });
      expect(res.status).toBe(500);
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
});
