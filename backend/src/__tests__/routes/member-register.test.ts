import { describe, it, expect } from "vitest";
import { routeConfig, memberRegisterRouter } from "../../routes/member-register.routes";

describe("routes/member-register", () => {
  it("应导出正确的 routeConfig", () => {
    expect(routeConfig).toBeDefined();
    expect(routeConfig.prefix).toBe("/api/store/members");
    expect(routeConfig.router).toBeDefined();
  });

  it("应配置公开访问（无需认证）", () => {
    expect(routeConfig.auth).toBe("none");
  });

  it("router 应该是一个 Router 实例", () => {
    expect(typeof memberRegisterRouter.get).toBe("function");
    expect(typeof memberRegisterRouter.post).toBe("function");
    expect(typeof memberRegisterRouter.put).toBe("function");
    expect(typeof memberRegisterRouter.delete).toBe("function");
  });

  it("应注册 /sms-code 和 /register 路由", () => {
    const paths = memberRegisterRouter.stack
      .filter((s: any) => s.route)
      .map((s: any) => s.route.path);
    expect(paths).toContain("/sms-code");
    expect(paths).toContain("/register");
  });

  it("/sms-code 应支持 POST 方法", () => {
    const layer = memberRegisterRouter.stack.find((s: any) => s.route?.path === "/sms-code");
    expect(layer.route.methods.post).toBe(true);
  });

  it("/register 应支持 POST 方法", () => {
    const layer = memberRegisterRouter.stack.find((s: any) => s.route?.path === "/register");
    expect(layer.route.methods.post).toBe(true);
  });
});