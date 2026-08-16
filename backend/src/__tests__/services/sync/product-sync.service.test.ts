import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: vi.fn(),
  query: vi.fn(),
  queryOne: vi.fn(),
}));
vi.mock("../../../shared/logger", () => ({ default: mocks.logger }));

import { syncProducts } from "../../../services/sync/product-sync.service";

const tenantId = "t1";
beforeEach(() => vi.clearAllMocks());

describe("product-sync.service", () => {
  it("syncProducts 可在线销售 → 同步并计数", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ spuId: 1, name: "茅台", allowOnlineSale: 1 }])
      .mockResolvedValueOnce([{ skuId: 1, price: 100 }]);
    const res = await syncProducts(tenantId, [1]);
    expect(res.syncedCount).toBe(1);
    expect(res.skippedCount).toBe(0);
    expect(res.totalCount).toBe(1);
    const ins = mocks.queryWithTenant.mock.calls.find((c) => String(c[0]).includes("INSERT INTO t_sync_cache"))!;
    expect(String(ins[0])).toContain("'product'");
  });

  it("syncProducts 禁止线上销售 → 跳过", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ spuId: 2, name: "内部", allowOnlineSale: 0 }]);
    const res = await syncProducts(tenantId, [2]);
    expect(res.skippedCount).toBe(1);
    expect(res.syncedCount).toBe(0);
    expect(mocks.logger.info).toHaveBeenCalled();
  });

  it("syncProducts 全量同步", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ spuId: 1, name: "A", allowOnlineSale: 1 }])
      .mockResolvedValueOnce([{ skuId: 1 }]);
    const res = await syncProducts(tenantId);
    expect(res.syncedCount).toBe(1);
  });
});
