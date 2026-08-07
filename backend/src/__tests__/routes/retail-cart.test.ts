import { describe, it, expect } from "vitest";
import { routeConfig } from "../../routes/retail-cart.routes";

describe("routes/retail-cart", () => {
  it("应导出正确的 routeConfig", () => {
    expect(routeConfig).toBeDefined();
    expect(routeConfig.prefix).toBe("/api/admin/retail-cart");
    expect(routeConfig.router).toBeDefined();
    expect(routeConfig.auth).toBe("requireAuthWithTenant");
  });

  it("应注册购物车分析端点", () => {
    const router = routeConfig.router as any;
    const paths = router.stack
      .filter((s: any) => s.route)
      .map((s: any) => `${Object.keys(s.route.methods)[0].toLowerCase()} ${s.route.path}`);
    expect(paths).toContain("get /analysis");
  });
});
