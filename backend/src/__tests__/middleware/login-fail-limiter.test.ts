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
  ACCOUNT_BACKSTOP_MAX,
  ACCOUNT_BACKSTOP_WINDOW_MS,
  ACCOUNT_BACKSTOP_MESSAGE,
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
    it("凭据 5 次/5 分钟锁 15 分钟；验证码 20 次/5 分钟；账号兜底 60 次/小时；文案均为中文", () => {
      expect(LOGIN_FAIL_MAX).toBe(5);
      expect(LOGIN_FAIL_WINDOW_MS).toBe(5 * 60_000);
      expect(LOGIN_FAIL_LOCK_MS).toBe(15 * 60_000);
      expect(CAPTCHA_FAIL_MAX).toBe(20);
      expect(CAPTCHA_FAIL_WINDOW_MS).toBe(5 * 60_000);
      // S3-58-F1 R2：账号维度兜底（分布式多 IP 打同一账号）
      expect(ACCOUNT_BACKSTOP_MAX).toBe(60);
      expect(ACCOUNT_BACKSTOP_WINDOW_MS).toBe(60 * 60_000);

      for (const m of [LOGIN_FAIL_MESSAGE, CAPTCHA_FAIL_MESSAGE, ACCOUNT_BACKSTOP_MESSAGE]) {
        expect(m.code).toBe("429");
        expect(m.msg).toMatch(/[一-龥]/);
        // eslint no-useless-escape：字符类末尾的 `-` 无需转义（S3-46；语义等价，仅去掉 `\`）
        expect(m.msg).not.toMatch(/^[A-Za-z0-9\s.,:;'"()-]+$/);
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

/**
 * S3-58-F1 R2（2026-10-06）——限流维度改造。
 *
 * 原缺陷：账号维度键 = 纯 `acct:<username>`，攻击者制造 5 次失败即可把**合法账号**
 * 锁死 15 分钟（换任何来源都登不上）。改造后：
 *   主键 = `acct:<name>|ip:<ipKey>`（快锁，5 次/5 分钟 + 5 次/15 分钟）
 *   兜底 = `acct:<name>`（60 次/1 小时，拦分布式多 IP）
 * IP 维度保持不变。
 *
 * 本组用例用 `X-Forwarded-For` + `trust proxy` 区分「来源」，
 * 并用独立实例（createLoginFailLimiters()）隔离计数。
 */
describe("middleware/login-fail-limiter（S3-58-F1 R2 维度改造）", () => {
  /** 与生产同构的桩：可区分来源 IP（trust proxy 让 req.ip 取 X-Forwarded-For） */
  function makeIpApp(limiters: unknown[]) {
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.post("/login", ...(limiters as never[]), (req, res) => {
      if (req.body?.password === "right") return res.json({ code: "0", msg: "成功" });
      return res.status(401).json({ code: "401", msg: "用户名或密码错误" });
    });
    return app;
  }

  const failFrom = (app: express.Express, ip: string, username = "alice") =>
    request(app).post("/login").set("X-Forwarded-For", ip).send({ username, password: "wrong" });
  const okFrom = (app: express.Express, ip: string, username = "alice") =>
    request(app).post("/login").set("X-Forwarded-For", ip).send({ username, password: "right" });

  it("来源区分手段有效：X-Forwarded-For 真的按来源分桶（否则本组证据无效）", async () => {
    const app = makeIpApp(createLoginFailLimiters(2).byIp);
    await failFrom(app, "203.0.113.1");
    await failFrom(app, "203.0.113.1");
    expect((await failFrom(app, "203.0.113.1")).status).toBe(429); // A 来源被锁
    expect((await failFrom(app, "203.0.113.2")).status).toBe(401); // B 来源独立计数
  });

  it("账号维度主键含来源 IP：A 来源快锁后，B 来源对同一账号仍可尝试", async () => {
    const app = makeIpApp(createLoginFailLimiters(2).byAccount);
    await failFrom(app, "203.0.113.1", "alice");
    await failFrom(app, "203.0.113.1", "alice");
    expect((await failFrom(app, "203.0.113.1", "alice")).status).toBe(429);
    // 换成复合键的旧实现（纯 acct:alice）时，下面这句会变成 429 —— 反测锚点
    expect((await failFrom(app, "203.0.113.2", "alice")).status).toBe(401);
  });

  it("① 合法用户换来源仍能登录：A 来源失败至锁定后，B 来源正确口令仍 200", async () => {
    const app = makeIpApp(createLoginFailLimiters().all);
    for (let i = 0; i < LOGIN_FAIL_MAX; i++) {
      expect((await failFrom(app, "203.0.113.7", "admin")).status).toBe(401);
    }
    // A 来源确实被锁（真的锁住，不是只提示）
    const lockedA = await failFrom(app, "203.0.113.7", "admin");
    expect(lockedA.status).toBe(429);
    expect(lockedA.body.msg).toMatch(/锁定/);
    // B 来源用正确口令 —— 不该被 A 来源的失败连坐
    const okB = await okFrom(app, "198.51.100.9", "admin");
    expect(okB.status).toBe(200);
    expect(okB.body.code).toBe("0");
  });

  it("② 分布式兜底仍拦：多来源累计到 60 次后，账号维度兜底锁住该账号", async () => {
    const app = makeIpApp(createLoginFailLimiters().all);
    let allowed = 0;
    // 12 个来源 × 5 次 = 60 次（每个来源都恰好停在 5 次快锁阈值上）
    for (let i = 0; i < 12; i++) {
      for (let k = 0; k < 5; k++) {
        const res = await failFrom(app, `10.0.${i}.1`, "admin");
        if (res.status === 401) allowed++;
      }
    }
    expect(allowed).toBe(ACCOUNT_BACKSTOP_MAX); // 60 次全部落到业务层（未被快锁误伤）

    const blocked = await failFrom(app, "10.0.99.1", "admin");
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("429");
    expect(blocked.body.msg).toMatch(/账号/);
    expect(blocked.body.msg).toMatch(/锁定/);
    // 兜底只打该账号：换账号仍可尝试（不是按 IP 全局封）
    expect((await failFrom(app, "10.0.99.1", "someone-else")).status).toBe(401);
  });

  it("单一来源锁不死合法账号：即便该来源持续失败，其它来源仍能拿到业务码", async () => {
    const app = makeIpApp(createLoginFailLimiters().all);
    // A 来源连打 30 次（含被快锁挡掉的部分）
    for (let i = 0; i < 30; i++) await failFrom(app, "203.0.113.50", "boss");
    // A 来源已被锁
    expect((await failFrom(app, "203.0.113.50", "boss")).status).toBe(429);
    // 兜底桶只记到 5 次（A 来源被快锁挡住后不再计入）——远低于 60，账号未被兜底锁
    expect((await failFrom(app, "203.0.113.51", "boss")).status).toBe(401);
  });
});
