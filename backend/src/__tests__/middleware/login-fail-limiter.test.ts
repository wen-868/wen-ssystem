import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import {
  createLoginFailLimiters,
  LOGIN_FAIL_MESSAGE,
  LOGIN_FAIL_MAX,
  LOGIN_FAIL_WINDOW_MS,
  LOGIN_FAIL_LOCK_MS,
} from "../../middleware/login-fail-limiter";

/**
 * 平台登录失败限流单测（R101-S2-01 批 2.1）
 *
 * 要点：
 *  - 用工厂函数创建独立实例，避免 MemoryStore 计数在用例间串味；
 *  - 覆盖阈值触发、中文文案、成功请求不计数、IP 维度、账号维度。
 */

/** 最小登录桩：password=right 视为成功，否则 401 */
function makeApp(limiters: unknown[]) {
  const app = express();
  app.use(express.json());
  app.post("/login", ...(limiters as never[]), (req, res) => {
    if (req.body?.password === "right") return res.json({ code: "0", msg: "成功" });
    return res.status(401).json({ code: "401", msg: "用户名或密码错误" });
  });
  return app;
}

const failLogin = (app: express.Express, username = "alice", password = "wrong") =>
  request(app).post("/login").send({ username, password });
const okLogin = (app: express.Express, username = "alice") =>
  request(app).post("/login").send({ username, password: "right" });

describe("middleware/login-fail-limiter", () => {
  describe("常量口径", () => {
    it("阈值 5 次 / 5 分钟，锁定窗口 15 分钟，文案为中文", () => {
      expect(LOGIN_FAIL_MAX).toBe(5);
      expect(LOGIN_FAIL_WINDOW_MS).toBe(5 * 60_000);
      expect(LOGIN_FAIL_LOCK_MS).toBe(15 * 60_000);
      expect(LOGIN_FAIL_MESSAGE.code).toBe("429");
      expect(LOGIN_FAIL_MESSAGE.msg).toMatch(/[一-龥]/); // 含中文
      expect(LOGIN_FAIL_MESSAGE.msg).not.toMatch(/^[A-Za-z0-9\s.,:;'"()\-]+$/); // 非纯英文
    });
  });

  describe("阈值触发（双维度串联）", () => {
    it("失败次数未达阈值时放行到业务层（401 而非 429）", async () => {
      const app = makeApp(createLoginFailLimiters(3).all);
      for (let i = 0; i < 3; i++) {
        const res = await failLogin(app);
        expect(res.status).toBe(401);
      }
    });

    it("达到阈值后返回 429 与中文提示，且不再进入业务层", async () => {
      const app = makeApp(createLoginFailLimiters(3).all);
      for (let i = 0; i < 3; i++) await failLogin(app);
      const blocked = await failLogin(app);
      expect(blocked.status).toBe(429);
      expect(blocked.body.code).toBe("429");
      expect(blocked.body.msg).toBe(LOGIN_FAIL_MESSAGE.msg);
    });

    it("超限后即便密码正确也被拒绝（锁定而非仅提示）", async () => {
      const app = makeApp(createLoginFailLimiters(2).all);
      await failLogin(app);
      await failLogin(app);
      const res = await okLogin(app);
      expect(res.status).toBe(429);
    });
  });

  describe("只统计失败（skipSuccessfulRequests）", () => {
    it("登录成功不消耗额度", async () => {
      const app = makeApp(createLoginFailLimiters(3).all);
      // 先成功 6 次（超过阈值），再失败 3 次（等于阈值）都应放行
      for (let i = 0; i < 6; i++) {
        const res = await okLogin(app);
        expect(res.status).toBe(200);
      }
      for (let i = 0; i < 3; i++) {
        const res = await failLogin(app);
        expect(res.status).toBe(401);
      }
      // 第 4 次失败才触发限流
      const blocked = await failLogin(app);
      expect(blocked.status).toBe(429);
    });
  });

  describe("IP 维度", () => {
    it("同一 IP 下换账号尝试同样被拦截", async () => {
      const app = makeApp(createLoginFailLimiters(2).byIp);
      await failLogin(app, "alice");
      await failLogin(app, "alice");
      const other = await failLogin(app, "bob");
      expect(other.status).toBe(429);
    });
  });

  describe("账号维度", () => {
    it("针对同一账号的尝试被拦截，不影响其他账号", async () => {
      const app = makeApp(createLoginFailLimiters(2).byAccount);
      await failLogin(app, "alice");
      await failLogin(app, "alice");
      expect((await failLogin(app, "alice")).status).toBe(429);

      // 账号维度独立：bob 的额度未被消耗
      expect((await failLogin(app, "bob")).status).toBe(401);
    });

    it("未提交账号时按 IP 归桶，避免所有匿名请求共用额度", async () => {
      const app = makeApp(createLoginFailLimiters(2).byAccount);
      const anon = () => request(app).post("/login").send({ password: "wrong" });
      expect((await anon()).status).toBe(401);
      expect((await anon()).status).toBe(401);
      expect((await anon()).status).toBe(429);
    });
  });
});
