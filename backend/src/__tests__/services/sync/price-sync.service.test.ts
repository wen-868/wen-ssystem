import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: vi.fn(),
  query: vi.fn(),
  queryOne: vi.fn(),
}));

import { getChangesSince, getPricesByIds, syncPrices, getSyncStatus, getLastSyncTime } from "../../../services/sync/price-sync.service";

const tenantId = "t1";
beforeEach(() => vi.clearAllMocks());

describe("price-sync.service", () => {
  it("getChangesSince 返回变更列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, productId: 2 }]);
    const res = await getChangesSince(tenantId, "2026-01-01");
    expect(res.length).toBe(1);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("t_price_change_log");
  });

  it("getPricesByIds 空 ids → []", async () => {
    const res = await getPricesByIds(tenantId, []);
    expect(res).toEqual([]);
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });

  it("getPricesByIds 有 ids → 返回价格", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ skuId: 1, price: 100 }]);
    const res = await getPricesByIds(tenantId, [1, 2]);
    expect(res[0].skuId).toBe(1);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("IN (?,?)");
  });

  it("syncPrices 指定 skuIds → 写入缓存并返回数量", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ skuId: 1, price: 100, storeId: 2 }]);
    const res = await syncPrices(tenantId, [1]);
    expect(res.syncedCount).toBe(1);
    const ins = mocks.queryWithTenant.mock.calls.find((c) => String(c[0]).includes("INSERT INTO t_sync_cache"))!;
    expect(String(ins[0])).toContain("'price'");
  });

  it("syncPrices 全量 → 写入缓存", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ skuId: 1, price: 100, storeId: 2 }]);
    const res = await syncPrices(tenantId);
    expect(res.syncedCount).toBe(1);
  });

  it("getSyncStatus 返回状态聚合", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ syncStatus: "synced", count: 3 }]);
    const res = await getSyncStatus(tenantId, "price");
    expect(res[0].count).toBe(3);
  });

  it("getLastSyncTime 有记录 → 返回时间", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ lastSyncTime: "2026-01-02" }]);
    const res = await getLastSyncTime(tenantId, "price");
    expect(res).toBe("2026-01-02");
  });

  it("getLastSyncTime 无记录 → null", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    const res = await getLastSyncTime(tenantId, "price");
    expect(res).toBeNull();
  });
});
