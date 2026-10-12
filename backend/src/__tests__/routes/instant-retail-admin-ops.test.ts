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

  // S3-179：/shelf 的唯一提供方是本文件（同 prefix 的 instant-retail-admin-platform.routes.ts
  // 里那 4 条同「方法 + 完整路径」的注册是死代码，已删除）。此处为正向断言，防止
  // 「两边都删掉 ⇒ /shelf 变成无人提供服务」这种回归。
  it("应注册货架 shelf 端点（同 prefix 的唯一提供方）", () => {
    const router = routeConfig.router as any;
    const paths = router.stack
      .filter((s: any) => s.route)
      .map((s: any) => `${Object.keys(s.route.methods)[0].toLowerCase()} ${s.route.path}`);
    expect(paths).toContain("get /shelf");
    expect(paths).toContain("post /shelf");
    expect(paths).toContain("put /shelf/:id");
    expect(paths).toContain("delete /shelf/:id");
  });
});
