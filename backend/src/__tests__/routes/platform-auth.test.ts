import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../shared/env", () => ({
  env: { JWT_SECRET: "test-secret" },
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
  // R48-06: controller 使用 signPlatformToken 签发平台 JWT，测试中 mock 为简单返回
  signPlatformToken: vi.fn((payload: Record<string, unknown>) =>
    JSON.stringify({ ...payload, _mock: true })
  ),
  PLATFORM_JWT_ISSUER: "zhixiang-platform",
  PLATFORM_JWT_AUDIENCE: "zhixiang-platform-client",
  MERCHANT_JWT_ISSUER: "zhixiang-system",
  MERCHANT_JWT_AUDIENCE: "zhixiang-client",
  signToken: vi.fn((user: unknown) => JSON.stringify({ user, _mock: true })),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
}));

import { queryOne } from "../../shared/db";
import { platformAuthRouter } from "../../routes/platform-auth.routes";

const app = createTestApp({ prefix: "/api/platform-auth", router: platformAuthRouter });

describe("routes/platform-auth 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("POST /login", () => {
    it("用户名或密码缺失时返回400", async () => {
      const res = await request(app)
        .post("/api/platform-auth/login")
        .send({ username: "", password: "" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("400");
    });

    it("管理员不存在时返回401", async () => {
      (queryOne as any).mockResolvedValue(null);
      const res = await request(app)
        .post("/api/platform-auth/login")
        .send({ username: "admin", password: "pass" });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("401");
    });

    it("密码错误时返回401", async () => {
      // R68-04：修复1：mock字段对齐service读取的password_hash（原误写为password）
      (queryOne as any).mockResolvedValue({ id: 1, username: "admin", password_hash: "hash", real_name: "管理员" });
      // R68-04：修复2：共享/crypto.ts 默认导入 bcrypt，调用的是 bcrypt.default.compare，
      // 原代码 mock 了命名 export compare，与controller handler实际调用路径不匹配
      const bcrypt = await import("bcryptjs");
      (bcrypt.default.compare as any).mockResolvedValue(false);
      const res = await request(app)
        .post("/api/platform-auth/login")
        .send({ username: "admin", password: "wrong" });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("401");
    });

    it("queryOne 抛错时返回500", async () => {
      (queryOne as any).mockRejectedValue(new Error("db error"));
      const res = await request(app)
        .post("/api/platform-auth/login")
        .send({ username: "admin", password: "pass" });
      expect(res.status).toBe(500);
    });
  });

  describe("GET /me", () => {
    it("应返回当前管理员信息", async () => {
      (queryOne as any).mockResolvedValue({ id: 1, username: "admin", real_name: "管理员" });
      const res = await request(app).get("/api/platform-auth/me");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(res.body.data.username).toBe("admin");
    });

    it("管理员不存在时返回404", async () => {
      (queryOne as any).mockResolvedValue(null);
      const res = await request(app).get("/api/platform-auth/me");
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("404");
    });

    it("queryOne 抛错时返回500", async () => {
      (queryOne as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/platform-auth/me");
      expect(res.status).toBe(500);
    });
  });
});
