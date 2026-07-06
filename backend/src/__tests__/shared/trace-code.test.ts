import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueryOneWithTenant } = vi.hoisted(() => ({
  mockQueryOneWithTenant: vi.fn(),
}));

vi.mock("../../shared/db.js", () => ({
  queryOneWithTenant: mockQueryOneWithTenant,
  query: vi.fn(),
  execute: vi.fn(),
}));

import { verifyTraceCodeSimple } from "../../shared/trace-code.js";

describe("verifyTraceCodeSimple", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("追溯码存在且未使用时返回 valid=true", async () => {
    mockQueryOneWithTenant.mockResolvedValue({
      trace_code: "TC001",
      status: "IN_STOCK",
      sku_id: 1,
    });

    const result = await verifyTraceCodeSimple("TC001", "1");
    expect(result.valid).toBe(true);
    expect(result.message).toBe("验证通过");
  });

  it("追溯码不存在时返回 valid=false", async () => {
    mockQueryOneWithTenant.mockResolvedValue(null);

    const result = await verifyTraceCodeSimple("TC001", "1");
    expect(result.valid).toBe(false);
    expect(result.message).toBe("追溯码不存在");
  });

  it("DB 查询出错时应抛出异常", async () => {
    mockQueryOneWithTenant.mockRejectedValue(new Error("DB Error"));

    await expect(verifyTraceCodeSimple("TC001", "1")).rejects.toThrow("DB Error");
  });
});