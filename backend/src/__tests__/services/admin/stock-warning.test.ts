/**
 * 库存预警 service 单元测试
 * 被测文件：src/services/admin/stock-warning.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db.js", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../shared/id.js", () => ({
  makeBizNo: vi.fn(),
}));

import {
  getStockWarnings,
  batchConfigStockWarning,
  getStockWarningConfigs,
} from "../../../services/admin/stock-warning.service.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("stock-warning.service - getStockWarnings", () => {
  it("有 storeId（storeCondition 非空 + if true）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ skuId: 1, warningLevel: "LOW" }]);
    const res = await getStockWarnings("t1", 1);
    expect(res).toHaveLength(1);
  });

  it("无 storeId（storeCondition 为空 + if false）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getStockWarnings("t1");
    expect(res).toEqual([]);
  });
});

describe("stock-warning.service - batchConfigStockWarning", () => {
  it("existing 有值 → UPDATE（if true）+ existing 无值 → INSERT（if false）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1 })  // config1 已存在 → UPDATE
      .mockResolvedValueOnce(null);        // config2 不存在 → INSERT
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await batchConfigStockWarning({
      storeId: 1, tenantId: "t1",
      configs: [
        { skuId: 1, minQty: 10, maxQty: 100 },
        { skuId: 2, minQty: 5, maxQty: 50 },
      ],
    });
    expect(res).toEqual({ storeId: 1, configured: 2 });
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
  });
});

describe("stock-warning.service - getStockWarningConfigs", () => {
  it("有 storeId", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1 }]);
    const res = await getStockWarningConfigs("t1", 1);
    expect(res).toHaveLength(1);
  });

  it("无 storeId", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getStockWarningConfigs("t1");
    expect(res).toEqual([]);
  });
});
