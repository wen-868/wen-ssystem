import { describe, it, expect } from "vitest";
import { routeConfigs } from "../../routes/store-control.routes.js";

describe("routes/store-control", () => {
  it("应导出 routeConfigs 数组", () => {
    expect(Array.isArray(routeConfigs)).toBe(true);
    expect(routeConfigs).toHaveLength(2);
  });

  it("管理后台门店管控路由配置应正确", () => {
    const adminConfig = routeConfigs[0];
    expect(adminConfig).toBeDefined();
    expect(adminConfig.prefix).toBe("/api/admin/store-control");
    expect(adminConfig.router).toBeDefined();
    expect(adminConfig.auth).toBe("requireAuthWithTenant");
  });

  it("门店端管控路由配置应正确", () => {
    const storeConfig = routeConfigs[1];
    expect(storeConfig).toBeDefined();
    expect(storeConfig.prefix).toBe("/api/store/control");
    expect(storeConfig.router).toBeDefined();
    expect(storeConfig.auth).toBe("requireAuthWithTenant");
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
