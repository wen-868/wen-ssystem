import { describe, it, expect } from "vitest";
import { tenantConfig } from "../../config/tenant.js";

describe("config/tenant", () => {
  it("应有默认存储配额", () => {
    expect(tenantConfig.DEFAULT_STORAGE_MB).toBe(10240);
  });
  it("应有最大租户数", () => {
    expect(tenantConfig.MAX_TENANTS).toBe(100);
  });
  it("应有试用期天数", () => {
    expect(tenantConfig.TRIAL_DAYS).toBe(30);
  });
});
