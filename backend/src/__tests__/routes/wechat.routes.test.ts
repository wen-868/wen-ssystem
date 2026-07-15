import { describe, it, expect, vi } from "vitest";
import { wechatRouter, routeConfig } from "../../routes/wechat.routes";

vi.mock("../../controllers/admin/wechat.controller", () => ({
  createWechatController: vi.fn().mockReturnValue({
    login: vi.fn(),
    decryptPhone: vi.fn(),
    updateProfile: vi.fn(),
    getProfile: vi.fn(),
    bind: vi.fn(),
    unbind: vi.fn(),
  }),
}));

vi.mock("../../shared/env", () => ({
  env: {
    WX_APPID: "test-appid",
    WX_APP_SECRET: "test-secret",
    JWT_SECRET: "test-jwt-secret",
  },
}));

vi.mock("jsonwebtoken", () => ({
  verify: vi.fn().mockImplementation((token: string, _secret: string) => {
    if (token === "valid-token") {
      return { wxUserId: 1, openid: "test-openid" };
    }
    throw new Error("Invalid token");
  }),
  sign: vi.fn().mockReturnValue("signed-token"),
}));

describe("wechat.routes", () => {
  it("应导出正确的 routeConfig", () => {
    expect(routeConfig).toBeDefined();
    expect(routeConfig.prefix).toBe("/api/miniapp/wechat");
    expect(routeConfig.router).toBeDefined();
    expect(routeConfig.auth).toBe("none");
  });

  it("router 应该是一个 Router 实例", () => {
    expect(typeof wechatRouter.get).toBe("function");
    expect(typeof wechatRouter.post).toBe("function");
    expect(typeof wechatRouter.put).toBe("function");
    expect(typeof wechatRouter.delete).toBe("function");
  });
});
