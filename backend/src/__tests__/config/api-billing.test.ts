import { describe, it, expect } from "vitest";
import { apiBillingConfig } from "../../config/api-billing.js";

describe("config/api-billing", () => {
  it("应有默认API调用消耗", () => {
    expect(apiBillingConfig.DEFAULT_API_COST).toBe(1);
  });
  it("应默认禁用计费", () => {
    expect(apiBillingConfig.ENABLED).toBe(false);
  });
});
