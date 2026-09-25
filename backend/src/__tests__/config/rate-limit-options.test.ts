/**
 * S3-112（P2）：CodeQL `js/missing-rate-limiting` 根因收敛的守卫测试
 *
 * 背景：`server.ts` 原先用 `createRateLimiter()` helper 返回限流中间件，
 * 而 CodeQL 只把"**注册点上直接出现的**限流中间件调用"识别为限流证据，
 * 于是全仓每新增一条路由（含测试内路由）都被误报一条 high 告警。
 *
 * 本文件守两件事：
 *  ① **行为不变**：options 构造的三分支（NODE_ENV=test / 无 REDIS_URL / 有 REDIS_URL）
 *     与 RedisStore 初始化失败降级逻辑，参数与传入一致；
 *  ② **形状不变**：`server.ts` 的限流注册点必须内联 `rateLimit(buildRateLimitOptions({…}))`，
 *     防止后人再包回 helper（形状断言反测：改回 `createRateLimiter(...)` 即变红）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 假 ioredis / rate-limit-redis：本测试只关心 options 形状，不连真 Redis
const mocks = vi.hoisted(() => ({
  redisConstructorCalls: [] as Array<{ url: string; options: Record<string, unknown> }>,
  redisInstances: [] as Array<{ errorHandlers: Array<(err: Error) => void> }>,
  storeInstances: [] as unknown[],
  storeConstructorCalls: [] as Array<Record<string, unknown>>,
  storeShouldThrow: false,
}));

vi.mock("ioredis", () => {
  class Redis {
    errorHandlers: Array<(err: Error) => void> = [];
    constructor(url?: unknown, options?: unknown) {
      mocks.redisConstructorCalls.push({
        url: String(url),
        options: (options ?? {}) as Record<string, unknown>,
      });
      mocks.redisInstances.push(this);
    }
    on(_event: string, handler: (err: Error) => void) {
      this.errorHandlers.push(handler);
      return this;
    }
    call(..._args: unknown[]) {
      return Promise.resolve(1);
    }
    quit() {
      return Promise.resolve("OK");
    }
    disconnect() {
      return undefined;
    }
  }
  return { Redis, default: Redis };
});

vi.mock("rate-limit-redis", () => {
  class RedisStore {
    sendCommand: (...args: unknown[]) => Promise<unknown>;
    constructor(options: { sendCommand: (...args: unknown[]) => Promise<unknown> }) {
      if (mocks.storeShouldThrow) throw new Error("mock RedisStore 初始化失败");
      mocks.storeConstructorCalls.push(options as unknown as Record<string, unknown>);
      mocks.storeInstances.push(this);
      this.sendCommand = options.sendCommand;
    }
  }
  return { RedisStore };
});

import { env } from "../../config/env";
import logger from "../../shared/logger";
import { buildRateLimitOptions } from "../../server";

describe("buildRateLimitOptions（S3-112：限流行为一字不改）", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRedisUrl = env.REDIS_URL;

  beforeEach(() => {
    mocks.redisConstructorCalls.length = 0;
    mocks.redisInstances.length = 0;
    mocks.storeConstructorCalls.length = 0;
    mocks.storeInstances.length = 0;
    mocks.storeShouldThrow = false;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    env.REDIS_URL = originalRedisUrl;
    vi.restoreAllMocks();
  });

  it("NODE_ENV=test ⇒ MemoryStore 分支：不带 store，即使配了 REDIS_URL 也不建 RedisStore", () => {
    process.env.NODE_ENV = "test";
    env.REDIS_URL = "redis://127.0.0.1:6379/0";

    const options = buildRateLimitOptions({ windowMs: 60_000, max: 2000 });

    expect(options).toMatchObject({
      standardHeaders: true,
      legacyHeaders: false,
      windowMs: 60_000,
      max: 2000,
    });
    expect("store" in options).toBe(false);
    expect(mocks.redisConstructorCalls).toHaveLength(0);
    expect(mocks.storeInstances).toHaveLength(0);
  });

  it("非 test 且未配置 REDIS_URL ⇒ MemoryStore 分支（保留原 logger.info）", () => {
    process.env.NODE_ENV = "production";
    env.REDIS_URL = "";
    const infoSpy = vi.spyOn(logger, "info");

    const options = buildRateLimitOptions({ windowMs: 60_000, max: 600 });

    expect(options).toMatchObject({ windowMs: 60_000, max: 600 });
    expect("store" in options).toBe(false);
    expect(infoSpy).toHaveBeenCalledWith(
      "[rate-limit] 未配置 REDIS_URL，限流器使用 MemoryStore（单进程内存）"
    );
    expect(mocks.storeInstances).toHaveLength(0);
  });

  it("非 test 且配置 REDIS_URL ⇒ RedisStore 分支：store 注入 options（保留 logger.info 与 ioredis 参数）", () => {
    process.env.NODE_ENV = "production";
    env.REDIS_URL = "redis://127.0.0.1:6379/9";
    const infoSpy = vi.spyOn(logger, "info");

    const options = buildRateLimitOptions({
      windowMs: 15 * 60_000,
      max: 100,
      message: "登录请求过于频繁，请15分钟后再试",
    });

    expect(options).toMatchObject({
      standardHeaders: true,
      legacyHeaders: false,
      windowMs: 15 * 60_000,
      max: 100,
      message: "登录请求过于频繁，请15分钟后再试",
    });
    expect(options.store).toBe(mocks.storeInstances[0]);
    expect(mocks.redisConstructorCalls).toEqual([
      {
        url: "redis://127.0.0.1:6379/9",
        options: { maxRetriesPerRequest: 3, enableOfflineQueue: false },
      },
    ]);
    expect(infoSpy).toHaveBeenCalledWith("[rate-limit] 限流器启用 RedisStore（REDIS_URL 已配置）");

    // Redis 运行时连接错误 → 走 error 事件记日志（原有容错行为）
    const errorSpy = vi.spyOn(logger, "error");
    mocks.redisInstances[0].errorHandlers.forEach((handler) => handler(new Error("boom")));
    expect(errorSpy).toHaveBeenCalledWith("[rate-limit] Redis 连接错误:", "boom");
  });

  it("RedisStore 构造抛错 ⇒ 降级 MemoryStore（不带 store，保留 logger.error）", () => {
    process.env.NODE_ENV = "production";
    env.REDIS_URL = "redis://127.0.0.1:6379/9";
    mocks.storeShouldThrow = true;
    const errorSpy = vi.spyOn(logger, "error");

    const options = buildRateLimitOptions({ windowMs: 60_000, max: 2000 });

    expect(options).toMatchObject({
      standardHeaders: true,
      legacyHeaders: false,
      windowMs: 60_000,
      max: 2000,
    });
    expect("store" in options).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      "[rate-limit] RedisStore 初始化失败，降级 MemoryStore:",
      "mock RedisStore 初始化失败"
    );
  });

  it("限流行为不变：max=3 时第 4 次请求 429，且响应头含 RateLimit-*（低 max 构造法见回传卡）", async () => {
    process.env.NODE_ENV = "production";
    env.REDIS_URL = "";

    const lowMaxApp = express();
    lowMaxApp.set("trust proxy", 1);
    // 与 server.ts 全局限流注册点同一写法、同一 options 构造器；只把 max 临时压到 3
    lowMaxApp.use(rateLimit(buildRateLimitOptions({ windowMs: 60_000, max: 3 })));
    lowMaxApp.get("/ping", (_req, res) => {
      res.json({ ok: true });
    });

    const responses = [];
    for (let i = 0; i < 4; i += 1) {
      responses.push(await request(lowMaxApp).get("/ping"));
    }

    expect(responses.slice(0, 3).map((res) => res.status)).toEqual([200, 200, 200]);
    expect(responses[3].status).toBe(429);
    expect(responses[0].headers["ratelimit-limit"]).toBe("3");
    expect(responses[0].headers["ratelimit-remaining"]).toBe("2");
    expect(responses[3].headers["ratelimit-limit"]).toBe("3");
  });
});

describe("server.ts 限流注册点形状（S3-112：让限流对 CodeQL 可见）", () => {
  const serverSource = readFileSync(
    fileURLToPath(new URL("../../server.ts", import.meta.url)),
    "utf8"
  );
  // 去掉注释后再断言：注释里会（也应该）解释"为什么不能写成 helper 形式"，
  // 若拿全文匹配，"禁止的写法"只出现在注释里也会被误判为违规（本测试首次真跑即暴露此点）。
  const serverCode = serverSource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("全局限流注册点必须是内联 `app.use(rateLimit(buildRateLimitOptions({…})))`", () => {
    const matched = serverCode.match(/app\.use\(\s*rateLimit\(([\s\S]*?)\)\s*\)\s*;/);
    expect(matched, "未找到 `app.use(rateLimit(...))` 形式的全局限流注册点").not.toBeNull();

    const registration = matched![1];
    expect(registration).toContain("buildRateLimitOptions(");
    expect(registration).toContain("windowMs: 60_000");
    expect(registration).toContain('process.env.NODE_ENV === "production" ? 600 : 2000');
  });

  it("登录接口限流器（admin/store）同样内联 `rateLimit(buildRateLimitOptions({…}))`", () => {
    expect(serverCode).toMatch(/const adminLoginLimiter = rateLimit\(buildRateLimitOptions\(/);
    expect(serverCode).toMatch(/const storeLoginLimiter = rateLimit\(buildRateLimitOptions\(/);
  });

  it("不存在把 rateLimit 包回 helper 的写法（防重构回退）", () => {
    expect(serverCode).not.toMatch(/app\.use\(\s*createRateLimiter\(/);
    expect(serverCode).not.toContain("function createRateLimiter(");
  });
});
