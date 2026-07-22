import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/instant-retail/retail-announcement.service", () => ({
  listAnnouncements: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
  getActiveAnnouncements: vi.fn(),
}));

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace" })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace" })),
}));

vi.mock("../../middleware/auth", () => ({
  // 真实 requireAuthWithTenant 是数组 [requireAuth, tenantMiddleware]
  // routes 文件用 router.use("/admin", requireAuthWithTenant) 直接传值（不 spread）
  // mock 成单个函数时，router.use 会当单个中间件执行，测试可正常通过
  requireAuthWithTenant: (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
  requirePlatformAuth: (_req: any, _res: any, next: any) => next(),
  // controller 中 import { hasAnyRole }，mock 必须导出该函数（否则抛 "No hasAnyRole export"）
  // 真实实现：SUPER_ADMIN 自动返回 true，否则检查 allowedRoles
  hasAnyRole: (user: any, allowedRoles: string[]) => {
    if (!user) return false;
    if (user.roles?.includes("SUPER_ADMIN")) return true;
    return allowedRoles.some((r) => user.roles?.includes(r));
  },
}));

// mock CSRF 中间件为直通（避免依赖 env.JWT_SECRET 生成 token）
vi.mock("../../middleware/csrf", () => ({
  csrfMiddleware: (_req: any, _res: any, next: any) => next(),
  generateCsrfToken: vi.fn(() => "fake-csrf-token"),
}));

import * as announcementService from "../../services/instant-retail/retail-announcement.service";
import { retailAnnouncementRouter } from "../../routes/retail-announcement.routes";

const TEST_TENANT = "test-tenant";

const app = createTestApp({ prefix: "/api/retail-announcement", router: retailAnnouncementRouter });

describe("routes/retail-announcement 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /admin/retail-announcements", () => {
    it("应返回公告列表（SUPER_ADMIN 从 query.storeId 获取门店）", async () => {
      (announcementService.listAnnouncements as any).mockResolvedValue([{ id: 1, title: "公告1" }]);
      const res = await request(app).get("/api/retail-announcement/admin/retail-announcements?storeId=1");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      // 关键：listAnnouncements 必须带 tenantId（来自 req.tenantId）
      expect(announcementService.listAnnouncements).toHaveBeenCalledWith(1, TEST_TENANT);
    });

    it("缺少 storeId 时返回403（SUPER_ADMIN 未指定门店）", async () => {
      const res = await request(app).get("/api/retail-announcement/admin/retail-announcements");
      expect(res.status).toBe(403);
      expect(announcementService.listAnnouncements).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (announcementService.listAnnouncements as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/retail-announcement/admin/retail-announcements?storeId=1");
      expect(res.status).toBe(500);
    });

    it("普通用户从 req.user.storeId 获取门店（不信任 query）", async () => {
      // 构造一个普通门店用户：storeId=2 绑定在 JWT 上
      const userApp = createTestApp({
        prefix: "/api/retail-announcement",
        router: retailAnnouncementRouter,
        mockUser: { id: 10, username: "store_user", roles: ["STORE_MANAGER"], storeId: 2, tenantId: TEST_TENANT },
      });
      (announcementService.listAnnouncements as any).mockResolvedValue([]);
      // 即使 query 传 storeId=999（其他门店），也应以 user.storeId=2 为准
      const res = await request(userApp).get(
        "/api/retail-announcement/admin/retail-announcements?storeId=999"
      );
      expect(res.status).toBe(200);
      expect(announcementService.listAnnouncements).toHaveBeenCalledWith(2, TEST_TENANT);
    });

    it("普通用户无 storeId 绑定时返回403", async () => {
      const userApp = createTestApp({
        prefix: "/api/retail-announcement",
        router: retailAnnouncementRouter,
        mockUser: { id: 11, username: "no_store_user", roles: ["STORE_MANAGER"], storeId: null, tenantId: TEST_TENANT },
      });
      const res = await request(userApp).get("/api/retail-announcement/admin/retail-announcements");
      expect(res.status).toBe(403);
      expect(announcementService.listAnnouncements).not.toHaveBeenCalled();
    });
  });

  describe("POST /admin/retail-announcements", () => {
    it("应创建公告（storeId 来自 req.user，schema 不含 store_id）", async () => {
      (announcementService.createAnnouncement as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .post("/api/retail-announcement/admin/retail-announcements?storeId=1")
        .send({ title: "新公告", content: "内容" });
      expect(res.status).toBe(200);
      // 关键：createAnnouncement 必须带 store_id（来自 req.user）和 tenantId
      expect(announcementService.createAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({ store_id: 1, title: "新公告", content: "内容" }),
        TEST_TENANT
      );
    });

    it("缺少必填字段时 zod 校验失败返回500", async () => {
      const res = await request(app)
        .post("/api/retail-announcement/admin/retail-announcements?storeId=1")
        .send({ title: "新公告" });
      expect(res.status).toBe(500);
      expect(announcementService.createAnnouncement).not.toHaveBeenCalled();
    });

    it("缺少 storeId 时返回403", async () => {
      const res = await request(app)
        .post("/api/retail-announcement/admin/retail-announcements")
        .send({ title: "新公告", content: "内容" });
      expect(res.status).toBe(403);
      expect(announcementService.createAnnouncement).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (announcementService.createAnnouncement as any).mockRejectedValue(new Error("create error"));
      const res = await request(app)
        .post("/api/retail-announcement/admin/retail-announcements?storeId=1")
        .send({ title: "新公告", content: "内容" });
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /admin/retail-announcements/:id", () => {
    it("应更新公告（带 storeId + tenantId 双重校验）", async () => {
      (announcementService.updateAnnouncement as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .put("/api/retail-announcement/admin/retail-announcements/1?storeId=1")
        .send({ title: "更新标题" });
      expect(res.status).toBe(200);
      // 关键：updateAnnouncement 必须带 storeId + tenantId，防止跨门店/租户修改
      expect(announcementService.updateAnnouncement).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: "更新标题" }),
        1,
        TEST_TENANT
      );
    });

    it("公告不存在或跨租户时 service 抛 404 返回404", async () => {
      const err = Object.assign(new Error("公告不存在或无权限"), { statusCode: 404 });
      (announcementService.updateAnnouncement as any).mockRejectedValue(err);
      const res = await request(app)
        .put("/api/retail-announcement/admin/retail-announcements/999?storeId=1")
        .send({ title: "更新" });
      expect(res.status).toBe(404);
    });

    it("缺少 storeId 时返回403", async () => {
      const res = await request(app)
        .put("/api/retail-announcement/admin/retail-announcements/1")
        .send({ title: "更新" });
      expect(res.status).toBe(403);
      expect(announcementService.updateAnnouncement).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (announcementService.updateAnnouncement as any).mockRejectedValue(new Error("update error"));
      const res = await request(app)
        .put("/api/retail-announcement/admin/retail-announcements/1?storeId=1")
        .send({ title: "更新" });
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /admin/retail-announcements/:id", () => {
    it("应删除公告（带 storeId + tenantId 双重校验）", async () => {
      (announcementService.deleteAnnouncement as any).mockResolvedValue(undefined);
      const res = await request(app).delete("/api/retail-announcement/admin/retail-announcements/1?storeId=1");
      expect(res.status).toBe(200);
      // 关键：deleteAnnouncement 必须带 storeId + tenantId，防止跨门店/租户删除
      expect(announcementService.deleteAnnouncement).toHaveBeenCalledWith(1, 1, TEST_TENANT);
    });

    it("公告不存在或跨租户时 service 抛 404 返回404", async () => {
      const err = Object.assign(new Error("公告不存在或无权限"), { statusCode: 404 });
      (announcementService.deleteAnnouncement as any).mockRejectedValue(err);
      const res = await request(app).delete("/api/retail-announcement/admin/retail-announcements/999?storeId=1");
      expect(res.status).toBe(404);
    });

    it("缺少 storeId 时返回403", async () => {
      const res = await request(app).delete("/api/retail-announcement/admin/retail-announcements/1");
      expect(res.status).toBe(403);
      expect(announcementService.deleteAnnouncement).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (announcementService.deleteAnnouncement as any).mockRejectedValue(new Error("delete error"));
      const res = await request(app).delete("/api/retail-announcement/admin/retail-announcements/1?storeId=1");
      expect(res.status).toBe(500);
    });
  });

  describe("跨租户数据隔离验证", () => {
    it("listAnnouncements 调用必须携带 tenantId 参数（防止跨租户读取）", async () => {
      (announcementService.listAnnouncements as any).mockResolvedValue([]);
      await request(app).get("/api/retail-announcement/admin/retail-announcements?storeId=1");
      const callArgs = (announcementService.listAnnouncements as any).mock.calls[0];
      // 第二个参数必须是 tenantId 字符串
      expect(callArgs[1]).toBe(TEST_TENANT);
      expect(typeof callArgs[1]).toBe("string");
    });

    it("createAnnouncement 调用必须携带 tenantId 参数（防止跨租户写入）", async () => {
      (announcementService.createAnnouncement as any).mockResolvedValue({ id: 1 });
      await request(app)
        .post("/api/retail-announcement/admin/retail-announcements?storeId=1")
        .send({ title: "新公告", content: "内容" });
      const callArgs = (announcementService.createAnnouncement as any).mock.calls[0];
      expect(callArgs[1]).toBe(TEST_TENANT);
    });

    it("updateAnnouncement 调用必须携带 storeId + tenantId（防止跨门店/租户修改）", async () => {
      (announcementService.updateAnnouncement as any).mockResolvedValue({ id: 1 });
      await request(app)
        .put("/api/retail-announcement/admin/retail-announcements/5?storeId=3")
        .send({ title: "更新" });
      const callArgs = (announcementService.updateAnnouncement as any).mock.calls[0];
      // 参数顺序: id, data, storeId, tenantId
      expect(callArgs[0]).toBe(5); // id
      expect(callArgs[2]).toBe(3); // storeId
      expect(callArgs[3]).toBe(TEST_TENANT); // tenantId
    });

    it("deleteAnnouncement 调用必须携带 storeId + tenantId（防止跨门店/租户删除）", async () => {
      (announcementService.deleteAnnouncement as any).mockResolvedValue(undefined);
      await request(app).delete("/api/retail-announcement/admin/retail-announcements/7?storeId=4");
      const callArgs = (announcementService.deleteAnnouncement as any).mock.calls[0];
      // 参数顺序: id, storeId, tenantId
      expect(callArgs[0]).toBe(7); // id
      expect(callArgs[1]).toBe(4); // storeId
      expect(callArgs[2]).toBe(TEST_TENANT); // tenantId
    });

    it("普通门店用户无法通过 query.storeId 访问其他门店公告", async () => {
      const userApp = createTestApp({
        prefix: "/api/retail-announcement",
        router: retailAnnouncementRouter,
        mockUser: { id: 20, username: "store_a", roles: ["STORE_MANAGER"], storeId: 10, tenantId: TEST_TENANT },
      });
      (announcementService.listAnnouncements as any).mockResolvedValue([]);
      // 攻击者尝试传 storeId=999 访问其他门店
      await request(userApp).get("/api/retail-announcement/admin/retail-announcements?storeId=999");
      // 实际应使用 user.storeId=10，忽略 query.storeId=999
      expect(announcementService.listAnnouncements).toHaveBeenCalledWith(10, TEST_TENANT);
    });
  });

  describe("GET /miniapp/retail-announcements（公开接口）", () => {
    it("应返回活跃公告列表（公开接口，无认证）", async () => {
      (announcementService.getActiveAnnouncements as any).mockResolvedValue([{ id: 1, title: "公告" }]);
      const res = await request(app).get("/api/retail-announcement/miniapp/retail-announcements?storeId=1");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      // 公开接口签名不变，仅 storeId
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
