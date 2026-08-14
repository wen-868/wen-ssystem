import { describe, it, expect } from "vitest";
import { permissionConfig } from "../../config/permission";

describe("config/permission", () => {
  it("应启用追溯码", () => {
    expect(permissionConfig.TRACE_ENABLED).toBe(true);
  });
  it("应启用批发价查看", () => {
    expect(permissionConfig.WHOLESALE_PRICE_ENABLED).toBe(true);
  });
  it("应禁用微信分享", () => {
    expect(permissionConfig.WECHAT_SHARE_ENABLED).toBe(false);
  });
  it("应禁用API计费", () => {
    expect(permissionConfig.API_BILLING_ENABLED).toBe(false);
  });
});
