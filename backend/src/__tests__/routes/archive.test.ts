import { describe, it, expect } from "vitest";
import { routeConfig } from "../../routes/archive.routes";

describe("routes/archive", () => {
  it("应导出正确的 routeConfig", () => {
    expect(routeConfig).toBeDefined();
    expect(routeConfig.prefix).toBe("/api/admin/archive");
    expect(routeConfig.router).toBeDefined();
  });

  it("archive 路由未显式配置 auth 字段", () => {
    expect(routeConfig.auth).toBeUndefined();
  });

  it("router 应该是一个 Router 实例", () => {
    expect(typeof routeConfig.router.get).toBe("function");
    expect(typeof routeConfig.router.post).toBe("function");
    expect(typeof routeConfig.router.put).toBe("function");
    expect(typeof routeConfig.router.delete).toBe("function");
  });
});
