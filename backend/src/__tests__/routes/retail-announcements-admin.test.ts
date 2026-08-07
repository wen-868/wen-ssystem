import { describe, it, expect } from "vitest";
import { routeConfig } from "../../routes/retail-announcements-admin.routes";

describe("routes/retail-announcements-admin", () => {
  it("应导出正确的 routeConfig（前端契约前缀）", () => {
    expect(routeConfig).toBeDefined();
    expect(routeConfig.prefix).toBe("/api/admin/retail-announcements");
    expect(routeConfig.router).toBeDefined();
    expect(routeConfig.auth).toBe("requireAuthWithTenant");
  });

  it("应注册公告 CRUD 端点", () => {
    const router = routeConfig.router as any;
    const paths = router.stack
      .filter((s: any) => s.route)
      .map((s: any) => `${Object.keys(s.route.methods)[0].toLowerCase()} ${s.route.path}`);
    expect(paths).toContain("get /");
    expect(paths).toContain("post /");
    expect(paths).toContain("put /:id");
    expect(paths).toContain("delete /:id");
  });
});
