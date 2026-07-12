import { describe, it, expect } from "vitest";
import { routeConfig, tenantRegisterRouter } from "../../routes/tenant-register.routes.js";

describe("routes/tenant-register", () => {
  it("应导出正确的 routeConfig", () => {
    expect(routeConfig).toBeDefined();
    expect(routeConfig.prefix).toBe("/api/tenant");
    expect(routeConfig.router).toBeDefined();
  });

  it("应配置公开访问（无需认证）", () => {
    expect(routeConfig.auth).toBe("none");
  });

  it("router 应该是一个 Router 实例", () => {
    expect(typeof tenantRegisterRouter.get).toBe("function");
    expect(typeof tenantRegisterRouter.post).toBe("function");
    expect(typeof tenantRegisterRouter.put).toBe("function");
    expect(typeof tenantRegisterRouter.delete).toBe("function");
  });

  it("应注册所有租户注册路由", () => {
    const paths = tenantRegisterRouter.stack
      .filter((s: any) => s.route)
      .map((s: any) => s.route.path);
    expect(paths).toContain("/register");
    expect(paths).toContain("/applications");
    expect(paths).toContain("/applications/:id");
    expect(paths).toContain("/applications/:id/approve");
    expect(paths).toContain("/applications/:id/reject");
  });

  it("/register 应支持 POST 方法", () => {
    const layer = tenantRegisterRouter.stack.find((s: any) => s.route?.path === "/register");
    expect(layer.route.methods.post).toBe(true);
  });

  it("/applications 应支持 GET 方法", () => {
    const layer = tenantRegisterRouter.stack.find((s: any) => s.route?.path === "/applications");
    expect(layer.route.methods.get).toBe(true);
  });

  it("/applications/:id/approve 应支持 POST 方法", () => {
    const layer = tenantRegisterRouter.stack.find((s: any) => s.route?.path === "/applications/:id/approve");
    expect(layer.route.methods.post).toBe(true);
  });

  it("/applications/:id/reject 应支持 POST 方法", () => {
    const layer = tenantRegisterRouter.stack.find((s: any) => s.route?.path === "/applications/:id/reject");
    expect(layer.route.methods.post).toBe(true);
  });
});