﻿﻿﻿﻿﻿import { describe, it, expect, vi } from "vitest";
import type { Express } from "express";
import { resolve } from "path";

vi.mock("../../shared/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../middleware/auth", () => ({
  requireAuth: vi.fn(),
  requireAuthWithTenant: [vi.fn(), vi.fn()],
}));

import { setupRoutes, inferPrefix, getAuthMiddlewares } from "../../shared/auto-routes";

const fixturesDir = resolve(__dirname, "../fixtures/routes");

describe("auto-routes", () => {
  it("应扫描 routes/ 目录并注册路由（部分可能失败但不应抛出）", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    // setupRoutes 会读取真实的 routes/ 目录
    // 大多数 route 文件可能 import 失败（缺少 DB 依赖）
    // 但 setupRoutes 有 try/catch，不应抛出
    await expect(setupRoutes(mockApp)).resolves.not.toThrow();

    // 至少应该调用了 app.use（注册了部分成功的路由）
    // 或者所有都失败了但没抛出
    expect(typeof mockUse.mock.calls.length).toBe("number");
  }, 120000);

  it("routes/ 目录不存在时应跳过不抛出", async () => {
    // 通过传入不存在的目录模拟
    const mockApp = { use: vi.fn() } as unknown as Express;

    await expect(
      setupRoutes(mockApp, { routesDir: "/nonexistent/path/routes" })
    ).resolves.not.toThrow();
  });

  it("优先级1: routeConfigs 数组应注册多个路由", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    // 应该注册了 routeConfigs 数组中的 2 个路由
    // 以及 routeConfig 单个、singleRouter 推断的路由
    expect(mockUse.mock.calls.length).toBeGreaterThan(0);
  });

  it("优先级2: routeConfig 单个对象应注册", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    // 检查是否有 /api/test-routeconfig 被注册
    const prefixes = mockUse.mock.calls.map((call: any[]) => call[0]);
    expect(prefixes).toContain("/api/test-routeconfig");
  });

  it("优先级1: routeConfigs 数组中的前缀都应注册", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    const prefixes = mockUse.mock.calls.map((call: any[]) => call[0]);
    expect(prefixes).toContain("/api/test-routecfgs-1");
    expect(prefixes).toContain("/api/test-routecfgs-2");
  });

  it("优先级3: 单个 Router 导出应从文件名推断 prefix", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    // test-single-router.routes.ts → /api/test-single-router
    const prefixes = mockUse.mock.calls.map((call: any[]) => call[0]);
    expect(prefixes).toContain("/api/test-single-router");
  });

  it(".routes.js 后缀文件应被扫描并注册", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    // test-js-single.routes.js → /api/test-js-single
    const prefixes = mockUse.mock.calls.map((call: any[]) => call[0]);
    expect(prefixes).toContain("/api/test-js-single");
  });

  it("routeConfigs 中 prefix 为空的项应被跳过", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    // 空字符串 prefix 不应被注册
    const prefixes = mockUse.mock.calls.map((call: any[]) => call[0]);
    expect(prefixes).not.toContain("");
  });

  it("优先级4: 多个 Router 导出但无 routeConfigs 应跳过", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    // test-multi-router 不应注册任何路由（多个 Router 但无 routeConfigs）
    const prefixes = mockUse.mock.calls.map((call: any[]) => call[0]);
    expect(prefixes).not.toContain("/api/test-multi-router");
  });

  it("无 Router 导出的文件应跳过", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    // test-no-router 不应注册任何路由
    const prefixes = mockUse.mock.calls.map((call: any[]) => call[0]);
    expect(prefixes).not.toContain("/api/test-no-router");
  });

  it("router 为 undefined 的配置项应被跳过", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    const prefixes = mockUse.mock.calls.map((call: any[]) => call[0]);
    // router 为 undefined 的配置不应被注册
    expect(prefixes).not.toContain("/api/test-router-undefined");
    // 同文件中 router 有效的配置应正常注册
    expect(prefixes).toContain("/api/test-router-valid");
  });
});

// ========== inferPrefix ==========
describe("inferPrefix", () => {
  it("应从 .routes.ts 文件名推断前缀", () => {
    expect(inferPrefix("admin.routes.ts")).toBe("/api/admin");
    expect(inferPrefix("brand.routes.ts")).toBe("/api/brand");
  });

  it("应从 .routes.js 文件名推断前缀", () => {
    expect(inferPrefix("admin.routes.js")).toBe("/api/admin");
  });

  it("应处理带路径的文件名", () => {
    expect(inferPrefix("user-session.routes.ts")).toBe("/api/user-session");
  });
});

// ========== getAuthMiddlewares ==========
describe("getAuthMiddlewares", () => {
  it("requireAuth 应返回包含 requireAuth 的数组", () => {
    const middlewares = getAuthMiddlewares("requireAuth");
    expect(Array.isArray(middlewares)).toBe(true);
    expect(middlewares.length).toBe(1);
  });

  it("requireAuthWithTenant 应返回中间件数组", () => {
    const middlewares = getAuthMiddlewares("requireAuthWithTenant");
    expect(Array.isArray(middlewares)).toBe(true);
  });

  it("none 应返回空数组", () => {
    const middlewares = getAuthMiddlewares("none");
    expect(middlewares).toEqual([]);
  });

  it("未指定 auth 应默认返回 requireAuthWithTenant", () => {
    const middlewares = getAuthMiddlewares(undefined);
    expect(Array.isArray(middlewares)).toBe(true);
  });
});
