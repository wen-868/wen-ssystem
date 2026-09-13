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

// R101-S2-01 裁定 4.1：登录路由新增 requireCaptcha 中间件。
// 本集成测试聚焦登录业务链路，验证码服务作为外部依赖在此 mock；
// 其自身行为由 services/platform/captcha.service.test.ts 独立覆盖。
const captchaMocks = vi.hoisted(() => ({
  createCaptcha: vi.fn(),
  verifyCaptcha: vi.fn(),
}));

vi.mock("../../services/platform/captcha.service", () => captchaMocks);

import { queryOne } from "../../shared/db";
import { platformAuthRouter } from "../../routes/platform-auth.routes";
import { loginFailLimiters, LOGIN_FAIL_MAX, LOGIN_FAIL_MESSAGE } from "../../middleware/login-fail-limiter";

const app = createTestApp({ prefix: "/api/platform-auth", router: platformAuthRouter });

describe("routes/platform-auth 集成测试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 批 2.1：登录失败限流是**真实生效**的，而本文件内多个用例都会产生失败登录。
    // 若不逐用例清空计数，前面的用例会消耗额度，导致后面的用例拿到 429 而非预期状态码。
    // 这是被测行为的正确表现，不是缺陷——隔离责任在测试侧。
    loginFailLimiters.reset();
    // 默认放行验证码，使既有登录用例继续聚焦账号密码逻辑
    captchaMocks.verifyCaptcha.mockResolvedValue({ ok: true, reason: "ok" });
    captchaMocks.createCaptcha.mockResolvedValue({
      captchaId: "test-captcha-id",
      image: "data:image/svg+xml;base64,PHN2Zy8+",
      expiresIn: 300,
    });
  });

  describe("GET /captcha", () => {
    it("下发图形验证码（captchaId + 图片 + 有效期）", async () => {
      const res = await request(app).get("/api/platform-auth/captcha");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(res.body.data.captchaId).toBe("test-captcha-id");
      expect(res.body.data.expiresIn).toBe(300);
      expect(String(res.body.data.image).startsWith("data:image/svg+xml;base64,")).toBe(true);
    });
  });

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

    it("图形验证码错误时返回400，且不进入账号密码校验", async () => {
      captchaMocks.verifyCaptcha.mockResolvedValue({ ok: false, reason: "mismatch" });
      const res = await request(app)
        .post("/api/platform-auth/login")
        .send({ username: "admin", password: "pass", captchaId: "x", captcha: "ZZZZ" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("400");
      expect(res.body.msg).toBe("图形验证码错误");
      expect(queryOne).not.toHaveBeenCalled();
    });

    it("图形验证码已失效时返回400并给出区分文案", async () => {
      captchaMocks.verifyCaptcha.mockResolvedValue({ ok: false, reason: "expired" });
      const res = await request(app)
        .post("/api/platform-auth/login")
        .send({ username: "admin", password: "pass", captchaId: "expired-id", captcha: "ABCD" });
      expect(res.status).toBe(400);
      expect(res.body.msg).toBe("图形验证码已失效，请点击图片重新获取");
    });

    it("未填写图形验证码时返回400", async () => {
      captchaMocks.verifyCaptcha.mockResolvedValue({ ok: false, reason: "missing" });
      const res = await request(app)
        .post("/api/platform-auth/login")
        .send({ username: "admin", password: "pass" });
      expect(res.status).toBe(400);
      expect(res.body.msg).toBe("请输入图形验证码");
    });

    // 批 2.1：证明限流在**真实登录路由**上生效（而非仅在中间件单测里生效）。
    // 阈值内的失败仍应拿到业务状态码（400/401），越过阈值才是 429。
    it(`连续失败 ${LOGIN_FAIL_MAX} 次内仍返回业务码，第 ${LOGIN_FAIL_MAX + 1} 次起返回 429 与中文提示`, async () => {
      (queryOne as any).mockResolvedValue(null); // 管理员不存在 → 401
      for (let i = 0; i < LOGIN_FAIL_MAX; i++) {
        const res = await request(app)
          .post("/api/platform-auth/login")
          .send({ username: "admin", password: "pass" });
        expect(res.status).toBe(401);
      }
      const blocked = await request(app)
        .post("/api/platform-auth/login")
        .send({ username: "admin", password: "pass" });
      expect(blocked.status).toBe(429);
      expect(blocked.body.code).toBe("429");
      expect(blocked.body.msg).toBe(LOGIN_FAIL_MESSAGE.msg);
      expect(blocked.body.msg).toMatch(/[一-龥]/);
    });

    it("限流生效期间即便账号密码正确也被拒绝（真的锁住，不是只提示）", async () => {
      (queryOne as any).mockResolvedValue(null);
      for (let i = 0; i < LOGIN_FAIL_MAX; i++) {
        await request(app)
          .post("/api/platform-auth/login")
          .send({ username: "admin", password: "pass" });
      }
      // 此时已超限；即便换成正确密码也不放行
      (queryOne as any).mockResolvedValue({
        id: 1,
        username: "admin",
        password_hash: "hash",
        real_name: "管理员",
      });
      const bcrypt = await import("bcryptjs");
      (bcrypt.default.compare as any).mockResolvedValue(true);
      const res = await request(app)
        .post("/api/platform-auth/login")
        .send({ username: "admin", password: "right" });
      expect(res.status).toBe(429);
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
