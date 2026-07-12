import { describe, it, expect } from "vitest";
import { routeConfig } from "../../routes/subscription.routes";

describe("routes/subscription", () => {
  it("应导出正确的 routeConfig", () => {
    expect(routeConfig).toBeDefined();
    expect(routeConfig.prefix).toBe("/api/admin/subscriptions");
    expect(routeConfig.router).toBeDefined();
  });

  it("应配置认证中间件", () => {
    expect(routeConfig.auth).toBe("requireAuthWithTenant");
  });

  it("router 应该是一个 Router 实例", () => {
    expect(typeof routeConfig.router.get).toBe("function");
    expect(typeof routeConfig.router.post).toBe("function");
    expect(typeof routeConfig.router.put).toBe("function");
    expect(typeof routeConfig.router.delete).toBe("function");
  });
});
