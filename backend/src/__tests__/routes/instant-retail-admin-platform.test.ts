import { describe, it, expect } from "vitest";
import { routeConfig } from "../../routes/instant-retail-admin-platform.routes";

describe("routes/instant-retail-admin-platform", () => {
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

  // S3-179：原用例断言「本文件注册 /shelf 端点」，但这 4 条与 instant-retail-admin-ops.routes.ts
  // 的 /shelf 完全同「方法 + 完整路径」，而本文件按文件名排序**后**注册 ⇒ 它们从未被执行（死代码）。
  // 断言翻转为**反向护栏**：/shelf 不得再出现在本文件（唯一提供方是 ops 文件，
  // 其正向断言见 instant-retail-admin-ops.test.ts）；若有人再次加回，auto-routes 的"真重复端点"
  // 阻断会在启动时直接拒绝，本用例则更早一步在单测里变红。
  it("不得注册货架 shelf 端点（死代码已删，唯一提供方是 ops 文件）", () => {
    const router = routeConfig.router as any;
    const paths = router.stack
      .filter((s: any) => s.route)
      .map((s: any) => `${Object.keys(s.route.methods)[0].toLowerCase()} ${s.route.path}`);
    expect(paths).not.toContain("get /shelf");
    expect(paths).not.toContain("post /shelf");
    expect(paths).not.toContain("put /shelf/:id");
    expect(paths).not.toContain("delete /shelf/:id");
  });
});
