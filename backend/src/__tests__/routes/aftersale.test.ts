import { describe, it, expect } from "vitest";
import { routeConfigs } from "../../routes/aftersale.routes";

describe("routes/aftersale", () => {
  it("应导出 routeConfigs 数组", () => {
    expect(Array.isArray(routeConfigs)).toBe(true);
    expect(routeConfigs).toHaveLength(2);
  });

  it("小程序售后路由配置应正确", () => {
    const miniappConfig = routeConfigs[0];
    expect(miniappConfig).toBeDefined();
    expect(miniappConfig.prefix).toBe("/api/miniapp/aftersales");
    expect(miniappConfig.router).toBeDefined();
    expect(miniappConfig.auth).toBe("none");
  });

  it("管理后台售后路由配置应正确", () => {
    const adminConfig = routeConfigs[1];
    expect(adminConfig).toBeDefined();
    expect(adminConfig.prefix).toBe("/api/admin/aftersales");
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
