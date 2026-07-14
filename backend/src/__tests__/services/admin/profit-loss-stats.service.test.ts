/**
 * 损益统计 service 单元测试
 * 被测文件：src/services/admin/profit-loss-stats.service.ts
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

import {
  getProfitLossStats,
} from "../../../services/admin/profit-loss-stats.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("profit-loss-stats.service - getProfitLossStats", () => {
  it("无筛选条件时返回完整统计数据", async () => {
    // 调用顺序：lossStats(1) + profitStats(2) + pendingLoss(3) + pendingProfit(4) + lossByType(5) + profitByType(6)
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ lossOrderCount: 10, lossTotalQty: 100, lossTotalAmount: 5000 })
      .mockResolvedValueOnce({ profitOrderCount: 5, profitTotalQty: 50, profitTotalAmount: 2500 })
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 2 });
    mocks.queryWithTenant
      .mockResolvedValueOnce([
        { lossType: "DAMAGE", orderCount: 5, totalQty: 50, totalAmount: 2500 },
        { lossType: "EXPIRED", orderCount: 3, totalQty: 30, totalAmount: 1500 },
      ])
      .mockResolvedValueOnce([
        { profitType: "COUNT_DIFF", orderCount: 3, totalQty: 30, totalAmount: 1500 },
      ]);

    const res = await getProfitLossStats({ tenantId: "t1" });

    expect(res.lossOrderCount).toBe(10);
    expect(res.lossTotalQty).toBe(100);
    expect(res.lossTotalAmount).toBe(5000);
    expect(res.profitOrderCount).toBe(5);
    expect(res.profitTotalQty).toBe(50);
    expect(res.profitTotalAmount).toBe(2500);
    expect(res.pendingLossCount).toBe(3);
    expect(res.pendingProfitCount).toBe(2);
    expect(res.netAmount).toBe(2500 - 5000);
    expect(res.netQty).toBe(50 - 100);
    expect(res.lossByType.length).toBe(2);
    expect(res.profitByType.length).toBe(1);
  });

  it("有日期范围和门店筛选时返回统计数据", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ lossOrderCount: 2, lossTotalQty: 20, lossTotalAmount: 1000 })
      .mockResolvedValueOnce({ profitOrderCount: 1, profitTotalQty: 10, profitTotalAmount: 500 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ lossType: "NORMAL", orderCount: 2, totalQty: 20, totalAmount: 1000 }])
      .mockResolvedValueOnce([]);

    const res = await getProfitLossStats({
      tenantId: "t1",
      storeId: 1,
      dateStart: "2026-01-01",
      dateEnd: "2026-12-31",
    });

    expect(res.lossOrderCount).toBe(2);
    expect(res.profitOrderCount).toBe(1);
    // 验证 storeId 条件被加入
    const firstCall = mocks.queryOneWithTenant.mock.calls[0];
    expect(firstCall[0]).toContain("store_id = ?");
  });

  it("lossStats 为 null 时全部兜底 0", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ profitOrderCount: 0, profitTotalQty: 0, profitTotalAmount: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    mocks.queryWithTenant
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await getProfitLossStats({ tenantId: "t1" });

    expect(res.lossOrderCount).toBe(0);
    expect(res.lossTotalQty).toBe(0);
    expect(res.lossTotalAmount).toBe(0);
  });

  it("profitStats 为 null 时全部兜底 0", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ lossOrderCount: 0, lossTotalQty: 0, lossTotalAmount: 0 })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    mocks.queryWithTenant
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await getProfitLossStats({ tenantId: "t1" });

    expect(res.profitOrderCount).toBe(0);
    expect(res.profitTotalQty).toBe(0);
    expect(res.profitTotalAmount).toBe(0);
  });

  it("pendingLoss 为 null 时兜底 0", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ lossOrderCount: 0, lossTotalQty: 0, lossTotalAmount: 0 })
      .mockResolvedValueOnce({ profitOrderCount: 0, profitTotalQty: 0, profitTotalAmount: 0 })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ count: 0 });
    mocks.queryWithTenant
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await getProfitLossStats({ tenantId: "t1" });
    expect(res.pendingLossCount).toBe(0);
  });

  it("pendingProfit 为 null 时兜底 0", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ lossOrderCount: 0, lossTotalQty: 0, lossTotalAmount: 0 })
      .mockResolvedValueOnce({ profitOrderCount: 0, profitTotalQty: 0, profitTotalAmount: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce(null);
    mocks.queryWithTenant
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await getProfitLossStats({ tenantId: "t1" });
    expect(res.pendingProfitCount).toBe(0);
  });
});
