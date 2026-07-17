import { describe, it, expect } from "vitest";
import { routeConfig } from "../../routes/platform.routes";

describe("routes/platform", () => {
  it("应导出正确的 routeConfig", () => {
    expect(routeConfig).toBeDefined();
    expect(routeConfig.prefix).toBe("/api/platform");
    expect(routeConfig.router).toBeDefined();
  });

  it("应配置平台认证中间件（R48-02 修复：平台路由不能使用 requireAuthWithTenant）", () => {
    expect(routeConfig.auth).toBe("requirePlatformAuth");
  });

  it("router 应该是一个 Router 实例", () => {
    expect(typeof routeConfig.router.get).toBe("function");
    expect(typeof routeConfig.router.post).toBe("function");
    expect(typeof routeConfig.router.put).toBe("function");
    expect(typeof routeConfig.router.delete).toBe("function");
  });
});

