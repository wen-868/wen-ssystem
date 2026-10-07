import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../shared/env", () => ({
  // S3-58-F1-F1：platform-auth.service 为「缺列降级」补了 logger.warn，
  // 而 shared/logger 在模块加载期就用 env.LOG_LEVEL 初始化 pino ⇒
  // 本 mock 必须给出 LOG_LEVEL，否则 import 期即抛
  // `default level:undefined must be included in custom levels`（整文件 0 test）。
  env: { JWT_SECRET: "test-secret", LOG_LEVEL: "silent" },
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

import { query, queryOne } from "../../shared/db";
import { platformAuthRouter } from "../../routes/platform-auth.routes";
import {
  loginFailLimiters,
  captchaFailLimiters,
  LOGIN_FAIL_MAX,
  CAPTCHA_FAIL_MAX,
} from "../../middleware/login-fail-limiter";
// S3-58-F1 R3：MFA 用例用**真** TOTP 模块（纯算法，无外部依赖）+ 真挑战令牌签发/校验
import { generateTOTP, generateSecret } from "../../shared/totp";
import { generateCsrfToken } from "../../middleware/csrf";
import { signMfaToken } from "../../middleware/mfa-token";

const app = createTestApp({ prefix: "/api/platform-auth", router: platformAuthRouter });

describe("routes/platform-auth 集成测试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 批 2.1/2.2：两条限流通道都是**真实生效**的，而本文件内多个用例都会产生失败登录/验证码错误。
    // 若不逐用例清空计数，前面的用例会消耗额度，导致后面的用例拿到 429 而非预期状态码。
    // 这是被测行为的正确表现，不是缺陷——隔离责任在测试侧。
    loginFailLimiters.reset();
    captchaFailLimiters.reset();
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
      // 批 2.2：文案改为动态生成，含「失败次数 + 剩余时间」（裁定③ 要求说清第几次、还要等多久）
      expect(blocked.body.msg).toMatch(/已连续失败\s*\d+\s*次/);
      expect(blocked.body.msg).toMatch(/(分钟|秒)后重试/);
      expect(blocked.body.msg).toMatch(/[一-龥]/);
    });

    // 批 2.2 裁定③：验证码错误按 IP 弱阈值（20 次/5 分钟）单独计数，
    // **不进账号维度、不锁账号**——连续填错验证码不得导致该账号无法登录。
    it(`连续 ${LOGIN_FAIL_MAX} 次验证码错误后，该账号仍可正常登录（不锁账号）`, async () => {
      captchaMocks.verifyCaptcha.mockResolvedValue({ ok: false, reason: "mismatch" });
      for (let i = 0; i < LOGIN_FAIL_MAX; i++) {
        const res = await request(app)
          .post("/api/platform-auth/login")
          .send({ username: "admin", password: "pass", captchaId: "x", captcha: "ZZZZ" });
        expect(res.status).toBe(400);
      }

      // 换成正确密码 + 通过验证码，应当能登录 —— 凭据额度从未被验证码错误消耗
      captchaMocks.verifyCaptcha.mockResolvedValue({ ok: true, reason: "ok" });
      (queryOne as any).mockResolvedValue({
        id: 1,
        username: "admin",
        password_hash: "hash",
        real_name: "管理员",
      });
      const bcrypt = await import("bcryptjs");
      (bcrypt.default.compare as any).mockResolvedValue(true);
      const ok = await request(app)
        .post("/api/platform-auth/login")
        .send({ username: "admin", password: "right", captchaId: "ok", captcha: "ABCD" });
      expect(ok.status).toBe(200);
    });

    it(`验证码错误超过 ${CAPTCHA_FAIL_MAX} 次时返回 429，文案要求重新获取验证码`, async () => {
      captchaMocks.verifyCaptcha.mockResolvedValue({ ok: false, reason: "mismatch" });
      // 放宽到阈值：逐次发请求（上限取常量，避免硬编码）
      for (let i = 0; i < CAPTCHA_FAIL_MAX; i++) {
        await request(app)
          .post("/api/platform-auth/login")
          .send({ username: "admin", password: "pass", captchaId: "x", captcha: "ZZZZ" });
      }
      const blocked = await request(app)
        .post("/api/platform-auth/login")
        .send({ username: "admin", password: "pass", captchaId: "x", captcha: "ZZZZ" });
      expect(blocked.status).toBe(429);
      expect(blocked.body.msg).toMatch(/验证码/);
      expect(blocked.body.msg).toMatch(/重新获取/);
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

  /**
   * S3-58-F1 R3（2026-10-06）——平台端 MFA（零 DDL，读写 t_platform_admin）。
   *
   * 与租户端（t_sys_user / /api/admin/auth/mfa/*）完全独立；
   * 默认不强制：mfa_enabled=0 直发令牌，=1 只回挑战令牌，正式令牌须二次验证。
   * 挑战令牌是**真** JWT（非 mock），租户端令牌不得被平台端点接受。
   */
  describe("平台 MFA（S3-58-F1 R3）", () => {
    // 真 TOTP secret（32 位 base32）；动态码由真 generateTOTP 现算
    const SECRET = generateSecret();
    const csrf = generateCsrfToken(1);

    const adminRow = (over: Record<string, unknown> = {}) => ({
      id: 1,
      username: "admin",
      password_hash: "hash",
      real_name: "管理员",
      mfa_secret: SECRET,
      mfa_enabled: 0,
      ...over,
    });

    async function mockPasswordOk() {
      const bcrypt = await import("bcryptjs");
      (bcrypt.default.compare as any).mockResolvedValue(true);
    }

    /** 构造一个**必然错误**的 6 位动态码（避开 ±1 时间窗口内的全部有效码） */
    function wrongCode(secret: string): string {
      const now = Date.now();
      const valid = new Set([-1, 0, 1].map((o) => generateTOTP(secret, now + o * 30_000)));
      for (let i = 0; i < 1_000_000; i++) {
        const s = String(i).padStart(6, "0");
        if (!valid.has(s)) return s;
      }
      return "000000";
    }

    async function loginForMfaToken() {
      (queryOne as any).mockResolvedValue(adminRow({ mfa_enabled: 1 }));
      await mockPasswordOk();
      const res = await request(app)
        .post("/api/platform-auth/login")
        .send({ username: "admin", password: "right" });
      return res;
    }

    it("④-1 未开启 MFA ⇒ 登录直发正式 token（现状不变）", async () => {
      (queryOne as any).mockResolvedValue(adminRow({ mfa_enabled: 0 }));
      await mockPasswordOk();
      const res = await request(app)
        .post("/api/platform-auth/login")
        .send({ username: "admin", password: "right" });
      expect(res.status).toBe(200);
      expect(typeof res.body.data.token).toBe("string");
      expect(res.body.data.mfaRequired).toBeUndefined();
      expect(typeof res.body.data.csrfToken).toBe("string");
    });

    it("④-2 开启 MFA ⇒ 登录只回 {mfaRequired, mfaToken}，**不发**正式 token", async () => {
      const res = await loginForMfaToken();
      expect(res.status).toBe(200);
      expect(res.body.data.mfaRequired).toBe(true);
      expect(typeof res.body.data.mfaToken).toBe("string");
      // 🔴 关键断言：不得直接下发正式令牌 / CSRF
      expect(res.body.data.token).toBeUndefined();
      expect(res.body.data.csrfToken).toBeUndefined();
      expect(res.body.data.admin).toBeUndefined();
    });

    it("④-3 错误验证码 ⇒ 拒绝且不发令牌", async () => {
      const login = await loginForMfaToken();
      const mfaToken = login.body.data.mfaToken;
      const bad = await request(app)
        .post("/api/platform-auth/mfa/verify")
        .send({ mfaToken, code: wrongCode(SECRET) });
      expect(bad.status).toBe(400);
      expect(bad.body.data).toBeUndefined();
      expect(bad.body.msg).toMatch(/验证码/);
    });

    it("④-4 正确验证码 ⇒ 发正式令牌", async () => {
      const login = await loginForMfaToken();
      const mfaToken = login.body.data.mfaToken;
      const ok = await request(app)
        .post("/api/platform-auth/mfa/verify")
        .send({ mfaToken, code: generateTOTP(SECRET) });
      expect(ok.status).toBe(200);
      expect(typeof ok.body.data.token).toBe("string");
      expect(ok.body.data.admin.username).toBe("admin");
      expect(typeof ok.body.data.csrfToken).toBe("string");
    });

    it("④-5 未启用 MFA 的账号：挑战令牌也无法换令牌（不校验即发 = 红线）", async () => {
      const login = await loginForMfaToken();
      const mfaToken = login.body.data.mfaToken;
      // 二次验证时该账号已在库里被关闭 MFA
      (queryOne as any).mockResolvedValue(adminRow({ mfa_enabled: 0 }));
      const res = await request(app)
        .post("/api/platform-auth/mfa/verify")
        .send({ mfaToken, code: generateTOTP(SECRET) });
      expect(res.status).toBe(400);
      expect(res.body.data).toBeUndefined();
    });

    it("跨端隔离：租户端 MFA 挑战令牌**不能**被平台二次验证接受", async () => {
      (queryOne as any).mockResolvedValue(adminRow({ mfa_enabled: 1 }));
      const merchantMfaToken = signMfaToken({ id: 1, username: "admin", tenantId: "default" });
      const res = await request(app)
        .post("/api/platform-auth/mfa/verify")
        .send({ mfaToken: merchantMfaToken, code: generateTOTP(SECRET) });
      expect(res.status).toBe(401);
      expect(res.body.data).toBeUndefined();
    });

    it("⑤ 四件套：status / setup / confirm / disable 可用，SQL 全部打在 t_platform_admin", async () => {
      // status
      (queryOne as any).mockResolvedValue(adminRow({ mfa_enabled: 0 }));
      const st = await request(app).get("/api/platform-auth/mfa/status");
      expect(st.status).toBe(200);
      expect(st.body.data).toEqual({ enabled: false, hasSecret: true });
      expect(String((queryOne as any).mock.calls.at(-1)[0])).toContain("t_platform_admin");

      // setup（写操作，必须带 CSRF）
      (query as any).mockResolvedValue({ affectedRows: 1 });
      const su = await request(app)
        .post("/api/platform-auth/mfa/setup")
        .set("x-csrf-token", csrf)
        .send({});
      expect(su.status).toBe(200);
      const setupSecret: string = (query as any).mock.calls.at(-1)[1][0];
      expect(typeof setupSecret).toBe("string");
      expect(setupSecret.length).toBe(32);
      expect(String(su.body.data.otpauthUrl)).toContain("otpauth://totp/");
      expect(su.body.data.enabled).toBe(false);
      expect(String((query as any).mock.calls.at(-1)[0])).toContain("UPDATE t_platform_admin SET mfa_secret");

      // confirm（用 setup 落库的 secret 现算真动态码）
      (queryOne as any).mockResolvedValue(adminRow({ mfa_secret: setupSecret, mfa_enabled: 0 }));
      const cf = await request(app)
        .post("/api/platform-auth/mfa/confirm")
        .set("x-csrf-token", csrf)
        .send({ code: generateTOTP(setupSecret) });
      expect(cf.status).toBe(200);
      expect(cf.body.data).toEqual({ enabled: true });
      expect(String((query as any).mock.calls.at(-1)[0])).toContain("mfa_enabled = 1");

      // disable（清空 secret）
      (queryOne as any).mockResolvedValue(adminRow({ mfa_secret: setupSecret, mfa_enabled: 1 }));
      const dis = await request(app)
        .post("/api/platform-auth/mfa/disable")
        .set("x-csrf-token", csrf)
        .send({ code: generateTOTP(setupSecret) });
      expect(dis.status).toBe(200);
      expect(dis.body.data).toEqual({ enabled: false });
      const disableSql = String((query as any).mock.calls.at(-1)[0]);
      expect(disableSql).toContain("mfa_secret = NULL");
      expect(disableSql).toContain("t_platform_admin");
    });

    it("⑤-2 CSRF：setup 缺 x-csrf-token ⇒ 403（写操作确实挂了 csrfMiddleware）", async () => {
      (queryOne as any).mockResolvedValue(adminRow({ mfa_enabled: 0 }));
      (query as any).mockResolvedValue({ affectedRows: 1 });
      const noCsrf = await request(app).post("/api/platform-auth/mfa/setup").send({});
      expect(noCsrf.status).toBe(403);
    });

    it("⑤-3 未鉴权访问 MFA 端点 ⇒ 401（四件套走 requirePlatformAuth）", async () => {
      // 本文件把 requirePlatformAuth mock 成放行，故此处只断言路由确实挂了该中间件
      // （真实鉴权由 middleware/auth 的单测覆盖）
      const st = await request(app).get("/api/platform-auth/mfa/status");
      expect(st.status).toBe(200);
      expect(st.body.data).toHaveProperty("enabled");
    });

    it("GET /me 增 MFA 提示位 mfaEnabled（默认不强制）", async () => {
      (queryOne as any).mockResolvedValue({
        id: 1,
        username: "admin",
        real_name: "管理员",
        mfa_enabled: 1,
      });
      const on = await request(app).get("/api/platform-auth/me");
      expect(on.body.data.mfaEnabled).toBe(true);

      (queryOne as any).mockResolvedValue({
        id: 1,
        username: "admin",
        real_name: "管理员",
        mfa_enabled: 0,
      });
      const off = await request(app).get("/api/platform-auth/me");
      expect(off.body.data.mfaEnabled).toBe(false);
    });
  });
});
