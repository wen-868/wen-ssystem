/**
 * S3-165：演示免密登录环境门控的唯一判定口径 —— config/env.ts 的 isDemoLoginEnabled()。
 * 本文件锁定两件事：
 *   ① 生产（NODE_ENV=production）必须关闭；
 *   ② NODE_ENV 未设置时 env.NODE_ENV 的默认值即 production ⇒ 仍是关闭（安全默认，不靠运维记得配）。
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { env, isDemoLoginEnabled } from "../../config/env";

const originalNodeEnv = env.NODE_ENV;

describe("config/env · isDemoLoginEnabled（演示免密登录唯一判定口径）", () => {
  afterEach(() => {
    env.NODE_ENV = originalNodeEnv;
  });

  it("NODE_ENV=production ⇒ 关闭（生产必须禁用免密 demo-login）", () => {
    env.NODE_ENV = "production";
    expect(isDemoLoginEnabled()).toBe(false);
  });

  it("NODE_ENV=development / test（非生产，含 CI 的 mock 环境）⇒ 开启", () => {
    env.NODE_ENV = "development";
    expect(isDemoLoginEnabled()).toBe(true);
    env.NODE_ENV = "test";
    expect(isDemoLoginEnabled()).toBe(true);
  });

  it("NODE_ENV 未设置 ⇒ env 默认 production ⇒ 关闭（安全默认）", async () => {
    const saved = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    vi.resetModules();
    try {
      const fresh = await import("../../config/env");
      expect(fresh.env.NODE_ENV).toBe("production");
      expect(fresh.isDemoLoginEnabled()).toBe(false);
    } finally {
      if (saved === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = saved;
      }
      vi.resetModules();
    }
  });
});
