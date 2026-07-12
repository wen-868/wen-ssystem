﻿﻿﻿﻿﻿/**
 * 库存成本核算 service 单元测试
 * 被测文件：src/services/admin/inventory-cost.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: vi.fn(),
}));

import {
  updateMovingAverageCost,
  getInventoryCostDetail,
  getInventoryCostTrend,
} from "../../../services/admin/inventory-cost.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("inventory-cost.service - updateMovingAverageCost", () => {
  it("sku 和 inv 都有值 + totalQty > 0（?. 左 + ?? 左 + if true）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ costPrice: 10, id: 1 })   // sku
      .mockResolvedValueOnce({ physicalQty: 20 });         // inv
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await updateMovingAverageCost({ skuId: 1, inQty: 10, inUnitPrice: 15, tenantId: "t1" });
    // newCost = (20*10 + 10*15) / 30 = 350/30 = 11.67
    expect(res.newCost).toBe(11.67);
    expect(res.oldCost).toBe(10);
  });

  it("sku 为 null + inv 为 null（?. 右 + ?? 右 + if false totalQty===0）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)   // sku → costPrice ?? 0
      .mockResolvedValueOnce(null);  // inv → physicalQty ?? 0
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await updateMovingAverageCost({ skuId: 99, inQty: 0, inUnitPrice: 10, tenantId: "t1" });
    // totalQty = 0 + 0 = 0 → if false → newCost = existingCost = 0
    expect(res.newCost).toBe(0);
  });
});

describe("inventory-cost.service - getInventoryCostDetail", () => {
  it("无日期筛选（conditions.length === 1 → where 为空）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ skuId: 1 }]);
    const res = await getInventoryCostDetail("t1");
    expect(res).toEqual([{ skuId: 1 }]);
  });

  it("有 startDate 和 endDate（conditions.length > 1 → where 非空）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    await getInventoryCostDetail("t1", "2026-01-01", "2026-12-31");
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });
});

describe("inventory-cost.service - getInventoryCostTrend", () => {
  it("无 skuId", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ date: "2026-07-01" }]);
    const res = await getInventoryCostTrend("t1");
    expect(res).toHaveLength(1);
  });

  it("有 skuId", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    await getInventoryCostTrend("t1", 5);
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });
});
