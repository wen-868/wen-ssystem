import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
}));

import { updateAlertThreshold } from "../../../services/store/inventory.service";

describe("store inventory updateAlertThreshold", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("更新 SKU 预警阈值", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    const result = await updateAlertThreshold(10, 8, "t1");
    expect(result.threshold).toBe(8);
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_product_sku SET warning_threshold"),
      [8, 10, "t1"],
      "t1"
    );
  });

  it("SKU 不存在抛 404", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 0 });
    await expect(updateAlertThreshold(999, 5, "t1")).rejects.toThrow("SKU 不存在");
  });
});
