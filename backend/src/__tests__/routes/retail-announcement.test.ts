import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app.js";

vi.mock("../../services/instant-retail/retail-announcement.service.js", () => ({
  listAnnouncements: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
  getActiveAnnouncements: vi.fn(),
}));

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace", apiCost: 0 })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace", apiCost: 0 })),
}));

vi.mock("../../middleware/auth.js", () => ({
  requireAuthWithTenant: (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
  requirePlatformAuth: (_req: any, _res: any, next: any) => next(),
}));

import * as announcementService from "../../services/instant-retail/retail-announcement.service.js";
import { retailAnnouncementRouter } from "../../routes/retail-announcement.routes.js";

const app = createTestApp({ prefix: "/api/retail-announcement", router: retailAnnouncementRouter });

describe("routes/retail-announcement 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /admin/retail-announcements", () => {
    it("应返回公告列表", async () => {
      (announcementService.listAnnouncements as any).mockResolvedValue([{ id: 1, title: "公告1" }]);
      const res = await request(app).get("/api/retail-announcement/admin/retail-announcements?storeId=1");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(announcementService.listAnnouncements).toHaveBeenCalledWith(1);
    });

    it("缺少 storeId 时返回400", async () => {
      const res = await request(app).get("/api/retail-announcement/admin/retail-announcements");
      expect(res.status).toBe(400);
      expect(announcementService.listAnnouncements).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (announcementService.listAnnouncements as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/retail-announcement/admin/retail-announcements?storeId=1");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /admin/retail-announcements", () => {
    it("应创建公告", async () => {
      (announcementService.createAnnouncement as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .post("/api/retail-announcement/admin/retail-announcements")
        .send({ store_id: 1, title: "新公告", content: "内容" });
      expect(res.status).toBe(200);
      expect(announcementService.createAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({ store_id: 1, title: "新公告", content: "内容" })
      );
    });

    it("缺少必填字段时 zod 校验失败返回500", async () => {
      const res = await request(app)
        .post("/api/retail-announcement/admin/retail-announcements")
        .send({ title: "新公告" });
      expect(res.status).toBe(500);
      expect(announcementService.createAnnouncement).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (announcementService.createAnnouncement as any).mockRejectedValue(new Error("create error"));
      const res = await request(app)
        .post("/api/retail-announcement/admin/retail-announcements")
        .send({ store_id: 1, title: "新公告", content: "内容" });
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /admin/retail-announcements/:id", () => {
    it("应更新公告", async () => {
      (announcementService.updateAnnouncement as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .put("/api/retail-announcement/admin/retail-announcements/1")
        .send({ title: "更新标题" });
      expect(res.status).toBe(200);
      expect(announcementService.updateAnnouncement).toHaveBeenCalledWith(1, expect.objectContaining({ title: "更新标题" }));
    });

    it("service 抛错时返回500", async () => {
      (announcementService.updateAnnouncement as any).mockRejectedValue(new Error("update error"));
      const res = await request(app)
        .put("/api/retail-announcement/admin/retail-announcements/1")
        .send({ title: "更新" });
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /admin/retail-announcements/:id", () => {
    it("应删除公告", async () => {
      (announcementService.deleteAnnouncement as any).mockResolvedValue(undefined);
      const res = await request(app).delete("/api/retail-announcement/admin/retail-announcements/1");
      expect(res.status).toBe(200);
      expect(announcementService.deleteAnnouncement).toHaveBeenCalledWith(1);
    });

    it("service 抛错时返回500", async () => {
      (announcementService.deleteAnnouncement as any).mockRejectedValue(new Error("delete error"));
      const res = await request(app).delete("/api/retail-announcement/admin/retail-announcements/1");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /miniapp/retail-announcements", () => {
    it("应返回活跃公告列表（公开接口）", async () => {
      (announcementService.getActiveAnnouncements as any).mockResolvedValue([{ id: 1, title: "公告" }]);
      const res = await request(app).get("/api/retail-announcement/miniapp/retail-announcements?storeId=1");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(announcementService.getActiveAnnouncements).toHaveBeenCalledWith(1);
    });

    it("缺少 storeId 时返回400", async () => {
      const res = await request(app).get("/api/retail-announcement/miniapp/retail-announcements");
      expect(res.status).toBe(400);
      expect(announcementService.getActiveAnnouncements).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (announcementService.getActiveAnnouncements as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/retail-announcement/miniapp/retail-announcements?storeId=1");
      expect(res.status).toBe(500);
    });
  });
});
