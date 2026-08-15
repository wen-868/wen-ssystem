import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import { updateMovingAverageCost, getInventoryCostDetail } from "../../../services/admin/inventory-cost.service";

describe("admin/inventory-cost.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("updateMovingAverageCost：加权平均成本更新", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ costPrice: 100, id: 10 }) // SKU 成本
      .mockResolvedValueOnce({ physicalQty: 10 }); // 库存
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });

    const result = await updateMovingAverageCost({ skuId: 10, inQty: 10, inUnitPrice: 120, tenantId: "t1" });
    // (10*100 + 10*120) / 20 = 110
    expect(result.newCost).toBe(110);
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_product_sku SET cost_price"),
      [110, 10, "t1"],
      "t1"
    );
  });

  it("getInventoryCostDetail：成本明细列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ skuName: "酒", costPrice: 100 }]);
    const result = await getInventoryCostDetail("t1");
    expect(result[0].skuName).toBe("酒");
  });
});
