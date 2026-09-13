import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import {
  createLoginFailLimiters,
  createCaptchaFailLimiters,
  LOGIN_FAIL_MESSAGE,
  CAPTCHA_FAIL_MESSAGE,
  LOGIN_FAIL_MAX,
  LOGIN_FAIL_WINDOW_MS,
  LOGIN_FAIL_LOCK_MS,
  CAPTCHA_FAIL_MAX,
  CAPTCHA_FAIL_WINDOW_MS,
} from "../../middleware/login-fail-limiter";

/**
 * 平台登录限流单测（R101-S2-01 批 2.1 建立，批 2.2 改为「按失败类型分流」）
 *
 * 两条通道：
 *  - 凭据错误（401）→ IP + 账号双维度，5 次 / 5 分钟，最长锁 15 分钟
 *  - 验证码错误（400）→ 仅 IP 维度，20 次 / 5 分钟，只拒绝不锁账号
 * 各自只统计自己关心的状态码（靠重写 requestWasSuccessful 实现）。
 *
 * 用工厂函数创建独立实例，避免 MemoryStore 计数在用例间串味。
 */

/** 登录桩：password=right → 200；captcha=bad → 400；否则 401 */
function makeApp(limiters: unknown[]) {
  const app = express();
  app.use(express.json());
  app.post("/login", ...(limiters as never[]), (req, res) => {
    if (req.body?.password === "right") return res.json({ code: "0", msg: "成功" });
    if (req.body?.captcha === "bad") return res.status(400).json({ code: "400", msg: "图形验证码错误" });
    return res.status(401).json({ code: "401", msg: "用户名或密码错误" });
  });
  return app;
}

const credFail = (app: express.Express, username = "alice") =>
  request(app).post("/login").send({ username, password: "wrong" });
const captchaFail = (app: express.Express, username = "alice") =>
  request(app).post("/login").send({ username, password: "wrong", captcha: "bad" });
const okLogin = (app: express.Express, username = "alice") =>
  request(app).post("/login").send({ username, password: "right" });

describe("middleware/login-fail-limiter（批 2.2 分流）", () => {
  describe("常量口径", () => {
    it("凭据 5 次/5 分钟锁 15 分钟；验证码 20 次/5 分钟；两条文案均为中文", () => {
      expect(LOGIN_FAIL_MAX).toBe(5);
      expect(LOGIN_FAIL_WINDOW_MS).toBe(5 * 60_000);
      expect(LOGIN_FAIL_LOCK_MS).toBe(15 * 60_000);
      expect(CAPTCHA_FAIL_MAX).toBe(20);
      expect(CAPTCHA_FAIL_WINDOW_MS).toBe(5 * 60_000);

      for (const m of [LOGIN_FAIL_MESSAGE, CAPTCHA_FAIL_MESSAGE]) {
        expect(m.code).toBe("429");
        expect(m.msg).toMatch(/[一-龥]/);
        expect(m.msg).not.toMatch(/^[A-Za-z0-9\s.,:;'"()\-]+$/);
      }
    });
  });

  describe("凭据通道（只计 401）", () => {
    it("未达阈值放行到业务层（401 而非 429）", async () => {
      const app = makeApp(createLoginFailLimiters(3).all);
      for (let i = 0; i < 3; i++) expect((await credFail(app)).status).toBe(401);
    });

    it("达到阈值后返回 429 且不再进入业务层", async () => {
      const app = makeApp(createLoginFailLimiters(3).all);
      for (let i = 0; i < 3; i++) await credFail(app);
      const blocked = await credFail(app);
      expect(blocked.status).toBe(429);
      expect(blocked.body.code).toBe("429");
    });

    it("文案含「失败次数」与「剩余时间」（裁定③：不能只丢一句请求过于频繁）", async () => {
      const app = makeApp(createLoginFailLimiters(2).all);
      await credFail(app);
      await credFail(app);
      const blocked = await credFail(app);
      expect(blocked.body.msg).toMatch(/已连续失败\s*\d+\s*次/);
      expect(blocked.body.msg).toMatch(/(分钟|秒)后重试/);
      expect(blocked.body.msg).toMatch(/锁定/);
    });

    it("超限后即便密码正确也被拒绝（锁定而非仅提示）", async () => {
      const app = makeApp(createLoginFailLimiters(2).all);
      await credFail(app);
      await credFail(app);
      expect((await okLogin(app)).status).toBe(429);
    });

    it("登录成功不消耗额度", async () => {
      const app = makeApp(createLoginFailLimiters(3).all);
      for (let i = 0; i < 6; i++) expect((await okLogin(app)).status).toBe(200);
      for (let i = 0; i < 3; i++) expect((await credFail(app)).status).toBe(401);
      expect((await credFail(app)).status).toBe(429);
    });

    it("IP 维度：同一 IP 换账号尝试同样被拦截", async () => {
      const app = makeApp(createLoginFailLimiters(2).byIp);
      await credFail(app, "alice");
      await credFail(app, "alice");
      expect((await credFail(app, "bob")).status).toBe(429);
    });

    it("账号维度：针对同一账号的尝试被拦截，不影响其他账号", async () => {
      const app = makeApp(createLoginFailLimiters(2).byAccount);
      await credFail(app, "alice");
      await credFail(app, "alice");
      expect((await credFail(app, "alice")).status).toBe(429);
      expect((await credFail(app, "bob")).status).toBe(401);
    });

    it("未提交账号时按 IP 归桶，避免所有匿名请求共用额度", async () => {
      const app = makeApp(createLoginFailLimiters(2).byAccount);
      const anon = () => request(app).post("/login").send({ password: "wrong" });
      expect((await anon()).status).toBe(401);
      expect((await anon()).status).toBe(401);
      expect((await anon()).status).toBe(429);
    });
  });

  describe("验证码通道（只计 400，仅 IP 维度，不锁账号）", () => {
    it("未达阈值放行到业务层（400 而非 429）", async () => {
      const app = makeApp(createCaptchaFailLimiters(3).all);
      for (let i = 0; i < 3; i++) expect((await captchaFail(app)).status).toBe(400);
    });

    it("超限返回 429，文案是验证码口径且要求重新获取", async () => {
      const app = makeApp(createCaptchaFailLimiters(2).all);
      await captchaFail(app);
      await captchaFail(app);
      const blocked = await captchaFail(app);
      expect(blocked.status).toBe(429);
      expect(blocked.body.msg).toMatch(/验证码/);
      expect(blocked.body.msg).toMatch(/重新获取/);
      expect(blocked.body.msg).toMatch(/(分钟|秒)后重试/);
      // 报真实失败次数（2 次）而非 3 次；且**不得**出现「锁定账号」字样
      expect(blocked.body.msg).toContain("已达 2 次");
      expect(blocked.body.msg).not.toMatch(/锁定/);
    });

    it("只按 IP 归桶：换账号名仍命中同一个桶", async () => {
      const app = makeApp(createCaptchaFailLimiters(2).all);
      await captchaFail(app, "alice");
      await captchaFail(app, "alice");
      expect((await captchaFail(app, "bob")).status).toBe(429);
    });

    it("不同账号不会各自开新桶（证明账号维度未参与）", async () => {
      const app = makeApp(createCaptchaFailLimiters(2).all);
      await captchaFail(app, "alice");
      await captchaFail(app, "bob");
      // 若按账号分桶，前两次各记 1 次、换 carol 应为 400；IP 单桶已满 → 429
      expect((await captchaFail(app, "carol")).status).toBe(429);
    });
  });

  describe("两条通道互不干扰（分流核心）", () => {
    it("验证码填错多次**不消耗**凭据额度（更不会锁账号）", async () => {
      const app = makeApp([...createCaptchaFailLimiters(20).all, ...createLoginFailLimiters(2).all]);
      // 连续 5 次验证码错误（已超过凭据阈值 2）
      for (let i = 0; i < 5; i++) expect((await captchaFail(app)).status).toBe(400);
      // 凭据额度未被消耗：正确密码仍可登录
      expect((await okLogin(app)).status).toBe(200);
    });

    it("密码输错多次**不消耗**验证码额度", async () => {
      const app = makeApp([...createCaptchaFailLimiters(2).all, ...createLoginFailLimiters(20).all]);
      // 连续 3 次 401（已超过验证码阈值 2）
      for (let i = 0; i < 3; i++) expect((await credFail(app)).status).toBe(401);
      // 验证码额度未被消耗：仍是业务 400 而非 429
      expect((await captchaFail(app)).status).toBe(400);
    });

    it("按生产挂载顺序：5 次验证码错误后，该账号仍可正常登录", async () => {
      const app = makeApp([...createCaptchaFailLimiters(20).all, ...createLoginFailLimiters(5).all]);
      for (let i = 0; i < 5; i++) await captchaFail(app, "admin");
      expect((await okLogin(app, "admin")).status).toBe(200);
    });
  });
});
