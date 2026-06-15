import { describe, expect, it } from "vitest";
import { normalizeStoreSaleBillItem } from "../routes/store.routes.js";

describe("门店销售单商品行", () => {
  it("兼容前端传入 quantity 作为销售瓶数", () => {
    const item = normalizeStoreSaleBillItem({
      skuId: 1,
      quantity: 1,
      unitPrice: 129
    });

    expect(item.totalBottleQty).toBe(1);
    expect(item.boxQty).toBe(0);
    expect(item.bottleQty).toBe(1);
  });

  it("保留正式字段 totalBottleQty", () => {
    const item = normalizeStoreSaleBillItem({
      skuId: 1,
      boxQty: 1,
      bottleQty: 2,
      totalBottleQty: 8,
      unitPrice: 99
    });

    expect(item.totalBottleQty).toBe(8);
    expect(item.boxQty).toBe(1);
    expect(item.bottleQty).toBe(2);
  });
});
