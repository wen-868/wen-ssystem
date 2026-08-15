import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

import { listSkuPrices, getBestPrice } from "../../../services/admin/price-management.service";

describe("admin/price-management.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("listSkuPrices：返回 SKU 阶梯价列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      { id: 1, skuId: 10, levelName: "批发价", minQty: 1, price: 95 },
    ]);
    const result = await listSkuPrices(10, "t1");
    expect(result.total).toBe(1);
    expect(result.records[0].levelName).toBe("批发价");
  });

  it("getBestPrice：有协议价等级时按折扣率计算", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ price_level_id: 2, level_code: "WHOLESALE", level_name: "批发价", discount_rate: 0.9 }) // 协议绑定
      .mockResolvedValueOnce({ id: 1, level_code: "RETAIL", level_name: "零售价", discount_rate: 1.0 }) // 零售等级
      .mockResolvedValueOnce({ id: 1, minQty: 1, price: 90, levelCode: "WHOLESALE", levelName: "批发价", discountRate: 0.9, suggestedRetailPrice: 100, costPrice: 80 }); // 阶梯价
    const result = await getBestPrice(1, 10, 1, false, "t1");
    expect(result.data.price).toBe(90);
  });
});
