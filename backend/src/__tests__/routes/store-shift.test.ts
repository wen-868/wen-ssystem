import { describe, it, expect } from "vitest";
import { routeConfig } from "../../routes/store-shift.routes";

describe("routes/store-shift", () => {
  it("应导出正确的 routeConfig", () => {
    expect(routeConfig).toBeDefined();
    expect(routeConfig.prefix).toBe("/api/store");
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

  it("应注册 S3-146 关闭交接班端点 POST /shifts/:shiftNo/close", () => {
    const stack = ((routeConfig.router as any).stack ?? []) as any[];
    const layer = stack.find(
      (s) => s.route?.path === "/shifts/:shiftNo/close" && s.route?.methods?.post
    );
    expect(layer).toBeDefined();
  });
});
