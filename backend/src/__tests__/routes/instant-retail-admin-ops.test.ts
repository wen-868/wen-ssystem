import { describe, it, expect } from "vitest";
import { routeConfig } from "../../routes/instant-retail-admin-ops.routes";

describe("routes/instant-retail-admin-ops", () => {
  it("应导出正确的 routeConfig", () => {
    expect(routeConfig).toBeDefined();
    expect(routeConfig.prefix).toBe("/api/admin/instant-retail");
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

  it("应注册 60 秒接单看板/支付/配送端点", () => {
    const router = routeConfig.router as any;
    const paths = router.stack
      .filter((s: any) => s.route)
      .map((s: any) => `${Object.keys(s.route.methods)[0].toLowerCase()} ${s.route.path}`);
    expect(paths).toContain("get /order-board");
    expect(paths).toContain("get /payments");
    expect(paths).toContain("get /payments/:paymentNo");
    expect(paths).toContain("get /deliveries");
    expect(paths).toContain("post /deliveries/:deliveryId/assign");
    expect(paths).toContain("put /deliveries/:deliveryId/status");
  });
});
