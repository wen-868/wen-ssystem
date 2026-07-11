import { describe, it, expect } from "vitest";
import { routeConfigs } from "../../routes/sale-return.routes.js";

describe("routes/sale-return", () => {
  it("应导出 routeConfigs 数组", () => {
    expect(Array.isArray(routeConfigs)).toBe(true);
    expect(routeConfigs).toHaveLength(2);
  });

  it("门店端销退路由配置应正确", () => {
    const storeConfig = routeConfigs[0];
    expect(storeConfig).toBeDefined();
    expect(storeConfig.prefix).toBe("/api/store/sale-returns");
    expect(storeConfig.router).toBeDefined();
    expect(storeConfig.auth).toBe("requireAuthWithTenant");
  });

  it("管理后台销退路由配置应正确", () => {
    const adminConfig = routeConfigs[1];
    expect(adminConfig).toBeDefined();
    expect(adminConfig.prefix).toBe("/api/admin/sale-returns");
    expect(adminConfig.router).toBeDefined();
    expect(adminConfig.auth).toBe("requireAuthWithTenant");
  });

  it("所有 router 都应该是 Router 实例", () => {
    routeConfigs.forEach((cfg) => {
      expect(typeof cfg.router.get).toBe("function");
      expect(typeof cfg.router.post).toBe("function");
      expect(typeof cfg.router.put).toBe("function");
      expect(typeof cfg.router.delete).toBe("function");
    });
  });
});
