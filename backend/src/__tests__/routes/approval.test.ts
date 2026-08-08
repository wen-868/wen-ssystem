import { describe, it, expect } from "vitest";
import { routeConfig } from "../../routes/approval.routes";

describe("routes/approval", () => {
  it("应导出正确的 routeConfig", () => {
    expect(routeConfig).toBeDefined();
    expect(routeConfig.prefix).toBe("/api/admin/approval");
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

  it("应注册 DELETE /rules/:id 删除规则路由", () => {
    const routes = routeConfig.router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({ method: layer.route.methods, path: layer.route.path }));
    expect(routes).toContainEqual({ method: { delete: true }, path: "/rules/:id" });
  });
});
