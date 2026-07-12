/**
 * 管理端收款报表 service 单元测试
 * 被测文件：src/services/admin/report-collection.service.ts
 * 覆盖全部 5 个导出函数，目标覆盖率 100%
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
  getCollectionFunnel,
  getChannelConversion,
  getCollectionTimeout,
  getCollectionDailyTrend,
  getCollectionSummary,
} from "../../../services/admin/report-collection.service";

const tenantId = "t1";

beforeEach(() => {
  vi.resetAllMocks();
});

// ============ getCollectionFunnel ============
describe("admin report-collection.service - getCollectionFunnel", () => {
  it("完整 params + 全部有值（if 全 true + 三元 true 分支）", async () => {
    // 4 次 queryOneWithTenant: shareCount, viewCount, payCount, payAmount
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ cnt: 100 })   // shareCount
      .mockResolvedValueOnce({ cnt: 60 })    // viewCount
      .mockResolvedValueOnce({ cnt: 30 })    // payCount
      .mockResolvedValueOnce({ amount: 5000 });// payAmount
    const res = await getCollectionFunnel({
      tenantId, startDate: "2026-01-01", endDate: "2026-12-31", storeId: 1,
    });
    expect(res.shareCount).toBe(100);
    expect(res.viewCount).toBe(60);
    expect(res.payCount).toBe(30);
    expect(res.payAmount).toBe(5000);
    expect(res.viewRate).toBe(60);       // 60/100*100 = 60
    expect(res.payRate).toBe(50);        // 30/60*100 = 50
    expect(res.overallConversionRate).toBe(30); // 30/100*100 = 30
  });

  it("仅 tenantId + 全部 null（if 全 false + ?? 右分支 + 三元 false 分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getCollectionFunnel({ tenantId });
    expect(res.shareCount).toBe(0);
    expect(res.viewCount).toBe(0);
    expect(res.payCount).toBe(0);
    expect(res.payAmount).toBe(0);
    expect(res.viewRate).toBe(0);
    expect(res.payRate).toBe(0);
    expect(res.overallConversionRate).toBe(0);
  });
});

// ============ getChannelConversion ============
describe("admin report-collection.service - getChannelConversion", () => {
  it("完整 params（if 全 true）", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      { channel: "WECHAT", totalCount: 50, conversionRate: 60 },
    ]);
    const res = await getChannelConversion({
      tenantId, startDate: "2026-01-01", endDate: "2026-12-31", storeId: 1,
    });
    expect(res).toHaveLength(1);
  });

  it("仅 tenantId（if 全 false）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getChannelConversion({ tenantId });
    expect(res).toEqual([]);
  });
});

// ============ getCollectionTimeout ============
describe("admin report-collection.service - getCollectionTimeout", () => {
  it("完整 params + 全部有值（if 全 true + totalAll > 0 三元 true）", async () => {
    // 8 次 queryOneWithTenant: total, timeout30min, timeout30to60, timeout1to2, timeout2to24, timeout24plus, avgTimeout, totalLinks
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ cnt: 20 })           // total
      .mockResolvedValueOnce({ cnt: 5, amount: 500 })   // timeout30min
      .mockResolvedValueOnce({ cnt: 4, amount: 400 })   // timeout30to60
      .mockResolvedValueOnce({ cnt: 3, amount: 300 })   // timeout1to2
      .mockResolvedValueOnce({ cnt: 2, amount: 200 })   // timeout2to24
      .mockResolvedValueOnce({ cnt: 6, amount: 600 })   // timeout24plus
      .mockResolvedValueOnce({ avgMinutes: 120 })       // avgTimeout
      .mockResolvedValueOnce({ cnt: 100 });             // totalLinks
    const res = await getCollectionTimeout({
      tenantId, startDate: "2026-01-01", endDate: "2026-12-31", storeId: 1,
    });
    expect(res.timeoutCount).toBe(20);
    expect(res.timeoutRate).toBe(20);   // 20/100*100 = 20
    expect(res.avgTimeoutMinutes).toBe(120);
    expect(res.intervals).toHaveLength(5);
    expect(res.intervals[0].count).toBe(5);
    expect(res.intervals[4].count).toBe(6);
  });

  it("仅 tenantId + 全部 null（if 全 false + ?? 右分支 + totalAll = 0 三元 false）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getCollectionTimeout({ tenantId });
    expect(res.timeoutCount).toBe(0);
    expect(res.timeoutRate).toBe(0);
    expect(res.avgTimeoutMinutes).toBe(0);
    expect(res.intervals).toHaveLength(5);
    expect(res.intervals[0].count).toBe(0);
  });

  it("total 为 null + totalAll > 0（?. null 分支 + 三元 true 分支）", async () => {
    // 第1个查询 total 返回 null，第8个查询 totalLinks 返回有值
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)                    // total → null（覆盖 ?. null 分支）
      .mockResolvedValueOnce({ cnt: 5, amount: 500 }) // timeout30min
      .mockResolvedValueOnce({ cnt: 4, amount: 400 }) // timeout30to60
      .mockResolvedValueOnce({ cnt: 3, amount: 300 }) // timeout1to2
      .mockResolvedValueOnce({ cnt: 2, amount: 200 }) // timeout2to24
      .mockResolvedValueOnce({ cnt: 6, amount: 600 }) // timeout24plus
      .mockResolvedValueOnce({ avgMinutes: 120 })     // avgTimeout
      .mockResolvedValueOnce({ cnt: 100 });           // totalLinks → 有值（totalAll > 0）
    const res = await getCollectionTimeout({ tenantId });
    expect(res.timeoutCount).toBe(0);   // total 为 null → 0
    expect(res.timeoutRate).toBe(0);    // 0/100*100 = 0
    expect(res.avgTimeoutMinutes).toBe(120);
  });
});

// ============ getCollectionDailyTrend ============
describe("admin report-collection.service - getCollectionDailyTrend", () => {
  it("完整 params（if 全 true）", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      { date: "2026-07-09", totalCount: 10, paidCount: 5, paidAmount: 1000, totalAmount: 2000 },
    ]);
    const res = await getCollectionDailyTrend({
      tenantId, startDate: "2026-01-01", endDate: "2026-12-31", storeId: 1,
    });
    expect(res).toHaveLength(1);
  });

  it("仅 tenantId（if 全 false）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getCollectionDailyTrend({ tenantId });
    expect(res).toEqual([]);
  });
});

// ============ getCollectionSummary ============
describe("admin report-collection.service - getCollectionSummary", () => {
  it("storeId 有值 + 全部有值（storeCondition true + refundRate 三元 true）", async () => {
    // 7 次 queryOneWithTenant: total, month, today, refund, totalPaid, avgCycle, totalAll
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ amount: 50000 })  // total
      .mockResolvedValueOnce({ amount: 10000 })  // month
      .mockResolvedValueOnce({ amount: 2000 })   // today
      .mockResolvedValueOnce({ amount: 500 })    // refund
      .mockResolvedValueOnce({ cnt: 30 })        // totalPaid
      .mockResolvedValueOnce({ avgHours: 24 })   // avgCycle
      .mockResolvedValueOnce({ amount: 100000 });// totalAll
    const res = await getCollectionSummary({ tenantId, storeId: 1 });
    expect(res.totalCollection).toBe(50000);
    expect(res.monthCollection).toBe(10000);
    expect(res.todayCollection).toBe(2000);
    expect(res.refundAmount).toBe(500);
    expect(res.refundRate).toBe(0.5);  // 500/100000*100 = 0.5
    expect(res.avgCollectionHours).toBe(24);
    expect(res.totalPaidCount).toBe(30);
  });

  it("storeId 无值 + 全部 null（storeCondition false + ?? 右分支 + refundRate 三元 false）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getCollectionSummary({ tenantId });
    expect(res.totalCollection).toBe(0);
    expect(res.monthCollection).toBe(0);
    expect(res.todayCollection).toBe(0);
    expect(res.refundAmount).toBe(0);
    expect(res.refundRate).toBe(0);
    expect(res.avgCollectionHours).toBe(0);
    expect(res.totalPaidCount).toBe(0);
  });

  it("refund 为 null + totalAll > 0（refund?.amount ?. null 分支 + refundRate 三元 true）", async () => {
    // 7 次 queryOneWithTenant: total, month, today, refund, totalPaid, avgCycle, totalAll
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ amount: 50000 })  // total
      .mockResolvedValueOnce({ amount: 10000 })  // month
      .mockResolvedValueOnce({ amount: 2000 })   // today
      .mockResolvedValueOnce(null)                // refund → null（覆盖 refund?.amount ?. null 分支）
      .mockResolvedValueOnce({ cnt: 30 })        // totalPaid
      .mockResolvedValueOnce({ avgHours: 24 })   // avgCycle
      .mockResolvedValueOnce({ amount: 100000 });// totalAll → 有值（> 0，进入三元 true 分支）
    const res = await getCollectionSummary({ tenantId, storeId: 1 });
    expect(res.refundAmount).toBe(0);    // refund 为 null → 0
    expect(res.refundRate).toBe(0);      // 0/100000*100 = 0
    expect(res.totalCollection).toBe(50000);
  });
});
