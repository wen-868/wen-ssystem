import { describe, it, expect } from "vitest";
import { routeConfig } from "../../routes/cart.routes";

describe("routes/cart", () => {
  it("应导出正确的 routeConfig", () => {
    expect(routeConfig).toBeDefined();
    expect(routeConfig.prefix).toBe("/api/miniapp/cart");
    expect(routeConfig.router).toBeDefined();
  });

  it("应配置认证中间件", () => {
    // S3-196（总清单第 52 项）：消费者端（/api/miniapp/**）改用 requireConsumerAuthWithTenant ——
    // 接受微信令牌并按 openid 解析绑定的会员身份；商家端 JWT 仍原样透传，故对既有调用方零回归。
    // 本断言随契约有意变更（唯一改动点），CSRF 仍由 auto-routes 成对附加，见 getAuthMiddlewares()。
    expect(routeConfig.auth).toBe("requireConsumerAuthWithTenant");
  });

  it("router 应该是一个 Router 实例", () => {
    expect(typeof routeConfig.router.get).toBe("function");
    expect(typeof routeConfig.router.post).toBe("function");
    expect(typeof routeConfig.router.put).toBe("function");
    expect(typeof routeConfig.router.delete).toBe("function");
  });
});
