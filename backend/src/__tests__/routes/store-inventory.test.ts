import { describe, it, expect } from "vitest";
import { routeConfigs } from "../../routes/store-inventory.routes";

describe("routes/store-inventory", () => {
  it("应导出收窄后的 routeConfigs（S3-195：不再以根前缀 /api/store 注册）", () => {
    expect(routeConfigs.map((c) => c.prefix)).toEqual(["/api/store/inventory"]);
    for (const config of routeConfigs) {
      expect(config.prefix.startsWith("/api/store/")).toBe(true);
      expect(config.prefix).not.toBe("/api/store");
      expect(config.router).toBeDefined();
    }
  });

  it("应逐条配置认证中间件", () => {
    for (const config of routeConfigs) expect(config.auth).toBe("requireAuthWithTenant");
  });

  it("router 应该是一个 Router 实例", () => {
    for (const config of routeConfigs) {
      expect(typeof config.router.get).toBe("function");
      expect(typeof config.router.post).toBe("function");
      expect(typeof config.router.put).toBe("function");
      expect(typeof config.router.delete).toBe("function");
    }
  });
});
