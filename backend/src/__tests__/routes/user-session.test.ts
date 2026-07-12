import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/admin/user-session.service", () => ({
  getUserSessions: vi.fn(),
  revokeSession: vi.fn(),
  getOnlineStats: vi.fn(),
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

import * as userSessionService from "../../services/admin/user-session.service";
import { userSessionRouter } from "../../routes/user-session.routes";

const app = createTestApp({ prefix: "/api/user-session", router: userSessionRouter });

describe("routes/user-session 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /", () => {
    it("应返回用户会话列表", async () => {
      (userSessionService.getUserSessions as any).mockResolvedValue({
        records: [{ id: 1, username: "admin" }],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      const res = await request(app).get("/api/user-session");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(userSessionService.getUserSessions).toHaveBeenCalledWith("test-tenant", expect.any(Object));
    });

    it("service 抛错时返回500", async () => {
      (userSessionService.getUserSessions as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/user-session");
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /:id", () => {
    it("应撤销指定会话", async () => {
      (userSessionService.revokeSession as any).mockResolvedValue({ success: true });
      const res = await request(app).delete("/api/user-session/1");
      expect(res.status).toBe(200);
      expect(userSessionService.revokeSession).toHaveBeenCalledWith(1);
    });

    it("service 抛错时返回500", async () => {
      (userSessionService.revokeSession as any).mockRejectedValue(new Error("revoke error"));
      const res = await request(app).delete("/api/user-session/1");
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /user/:userId", () => {
    it("应撤销用户所有会话", async () => {
      (userSessionService.getUserSessions as any).mockResolvedValue({
        records: [{ id: 1 }, { id: 2 }],
      });
      (userSessionService.revokeSession as any).mockResolvedValue({ success: true });
      const res = await request(app).delete("/api/user-session/user/10");
      expect(res.status).toBe(200);
      expect(userSessionService.getUserSessions).toHaveBeenCalledWith("test-tenant", { userId: 10 });
      expect(userSessionService.revokeSession).toHaveBeenCalledTimes(2);
    });

    it("用户无会话时返回成功", async () => {
      (userSessionService.getUserSessions as any).mockResolvedValue({ records: [] });
      const res = await request(app).delete("/api/user-session/user/10");
      expect(res.status).toBe(200);
      expect(userSessionService.revokeSession).not.toHaveBeenCalled();
    });

    it("records为undefined时使用空数组兜底", async () => {
      (userSessionService.getUserSessions as any).mockResolvedValue({});
      const res = await request(app).delete("/api/user-session/user/10");
      expect(res.status).toBe(200);
      expect(userSessionService.revokeSession).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (userSessionService.getUserSessions as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).delete("/api/user-session/user/10");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /stats", () => {
    it("应返回在线统计", async () => {
      (userSessionService.getOnlineStats as any).mockResolvedValue({ onlineCount: 5 });
      const res = await request(app).get("/api/user-session/stats");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(userSessionService.getOnlineStats).toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (userSessionService.getOnlineStats as any).mockRejectedValue(new Error("stats error"));
      const res = await request(app).get("/api/user-session/stats");
      expect(res.status).toBe(500);
    });
  });
});
