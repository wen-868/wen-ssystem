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
}));

import {
  getMarketingOverview,
  getActivityStats,
  getSingleActivityStats,
  getCouponStats,
  getMarketingTrend,
  getActivityRanking,
  getActivityComparison,
  getActivityEffectAnalysis,
  getActivityConversionTrend,
} from "../../../services/admin/marketing-dashboard.service";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin marketing-dashboard.service - getMarketingOverview", () => {
  it("无日期筛选", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total: 10, active: 5 })
      .mockResolvedValueOnce({ total: 20, active: 15 })
      .mockResolvedValueOnce({ total: 30, active: 25 })
      .mockResolvedValueOnce({ total: 40, active: 35 });
    const res = await getMarketingOverview({ tenantId });
    expect(res.totalActivities).toBe(100);
    expect(res.activeActivities).toBe(80);
  });

  it("有日期筛选", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total: 2, active: 1 })
      .mockResolvedValueOnce({ total: 3, active: 2 })
      .mockResolvedValueOnce({ total: 4, active: 3 })
      .mockResolvedValueOnce({ total: 5, active: 4 });
    const res = await getMarketingOverview({ tenantId, startDate: "2026-01-01", endDate: "2026-12-31" });
    expect(res.totalActivities).toBe(14);
    expect(res.activeActivities).toBe(10);
  });

  it("stats 为 null（Number(null ?? 0) = 0）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const res = await getMarketingOverview({ tenantId });
    expect(res.totalActivities).toBe(0);
    expect(res.activeActivities).toBe(0);
  });
});

describe("admin marketing-dashboard.service - getActivityStats", () => {
  it("返回固定统计数据", async () => {
    const res = await getActivityStats({ tenantId });
    expect(res.totalParticipants).toBe(0);
    expect(res.orderCount).toBe(0);
    expect(res.roi).toBe(0);
  });
});

describe("admin marketing-dashboard.service - getSingleActivityStats", () => {
  it("返回活动详情统计", async () => {
    const res = await getSingleActivityStats(1, "COUPON", tenantId);
    expect(res.activityId).toBe(1);
    expect(res.activityType).toBe("COUPON");
    expect(res.participants).toBe(0);
  });
});

describe("admin marketing-dashboard.service - getCouponStats", () => {
  it("正常统计", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ cnt: 100 })
      .mockResolvedValueOnce({ cnt: 30 });
    const res = await getCouponStats(tenantId);
    expect(res.couponIssued).toBe(100);
    expect(res.couponUsed).toBe(30);
    expect(res.couponUsageRate).toBe(30);
  });

  it("issued 为 0 → usageRate 0", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ cnt: 0 })
      .mockResolvedValueOnce({ cnt: 0 });
    const res = await getCouponStats(tenantId);
    expect(res.couponUsageRate).toBe(0);
  });

  it("stats 为 null", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const res = await getCouponStats(tenantId);
    expect(res.couponIssued).toBe(0);
    expect(res.couponUsed).toBe(0);
  });
});

describe("admin marketing-dashboard.service - getMarketingTrend", () => {
  it("period = month", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ period: "2026-01", issuedCount: 10, usedCount: 5 }])
      .mockResolvedValueOnce([{ period: "2026-01", count: 20, amount: 2000 }]);
    const res = await getMarketingTrend({ tenantId, period: "month" });
    expect(res.couponTrend).toHaveLength(1);
    expect(res.discountTrend).toHaveLength(1);
  });

  it("period = week", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const res = await getMarketingTrend({ tenantId, period: "week" });
    expect(res.couponTrend).toHaveLength(0);
  });

  it("period = day（默认）", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ period: "2026-01-01", issuedCount: 5, usedCount: 3 }])
      .mockResolvedValueOnce([{ period: "2026-01-01", count: 10, amount: 1000 }]);
    const res = await getMarketingTrend({ tenantId });
    expect(res.couponTrend).toHaveLength(1);
  });

  it("有日期筛选", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const res = await getMarketingTrend({ tenantId, startDate: "2026-01-01", endDate: "2026-12-31" });
    expect(res.couponTrend).toHaveLength(0);
  });
});

describe("admin marketing-dashboard.service - getActivityRanking", () => {
  it("返回排序数据", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      { activityId: 1, activityName: "活动1", activityType: "COUPON", totalIssued: 100, usedCount: 30, uniqueUsers: 25 }
    ]);
    const res = await getActivityRanking({ tenantId });
    expect(res).toHaveLength(1);
    expect(res[0].activityId).toBe(1);
    expect(res[0].usedRate).toBe(30);
  });

  it("返回空数组", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    const res = await getActivityRanking({ tenantId });
    expect(res).toEqual([]);
  });
});

describe("admin marketing-dashboard.service - getActivityComparison", () => {
  it("返回空数组", async () => {
    const res = await getActivityComparison({ tenantId });
    expect(res).toEqual([]);
  });
});

describe("admin marketing-dashboard.service - getActivityEffectAnalysis", () => {
  it("正常返回效果分析数据", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ totalUsers: 100, uniqueUsers: 80, usedCount: 30 })
      .mockResolvedValueOnce({ orderCount: 20, totalOrderAmount: 2000, totalDiscountAmount: 200 });
    const res = await getActivityEffectAnalysis({ tenantId, activityId: 1, activityType: "COUPON" });
    expect(res.activityId).toBe(1);
    expect(res.totalUsers).toBe(100);
    expect(res.usedRate).toBe(30);
    expect(res.conversionRate).toBe(66.67);
  });

  it("totalUsers 为 0 时 usedRate 为 0", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ totalUsers: 0, uniqueUsers: 0, usedCount: 0 })
      .mockResolvedValueOnce({ orderCount: 0, totalOrderAmount: 0, totalDiscountAmount: 0 });
    const res = await getActivityEffectAnalysis({ tenantId, activityId: 1, activityType: "COUPON" });
    expect(res.usedRate).toBe(0);
    expect(res.conversionRate).toBe(0);
  });

  it("usedCount 为 0 时 conversionRate 为 0", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ totalUsers: 100, uniqueUsers: 50, usedCount: 0 })
      .mockResolvedValueOnce({ orderCount: 0, totalOrderAmount: 0, totalDiscountAmount: 0 });
    const res = await getActivityEffectAnalysis({ tenantId, activityId: 1, activityType: "COUPON" });
    expect(res.conversionRate).toBe(0);
  });

  it("orderCount 为 0 时 avgOrderAmount 为 0", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ totalUsers: 100, uniqueUsers: 50, usedCount: 10 })
      .mockResolvedValueOnce({ orderCount: 0, totalOrderAmount: 0, totalDiscountAmount: 50 });
    const res = await getActivityEffectAnalysis({ tenantId, activityId: 1, activityType: "COUPON" });
    expect(res.avgOrderAmount).toBe(0);
    expect(res.roi).toBe(0);
  });

  it("stats 为 null", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const res = await getActivityEffectAnalysis({ tenantId, activityId: 1, activityType: "COUPON" });
    expect(res.totalUsers).toBe(0);
    expect(res.orderCount).toBe(0);
  });

  it("带日期筛选", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ totalUsers: 50, uniqueUsers: 40, usedCount: 15 })
      .mockResolvedValueOnce({ orderCount: 10, totalOrderAmount: 1000, totalDiscountAmount: 100 });
    const res = await getActivityEffectAnalysis({ tenantId, activityId: 1, activityType: "COUPON", startDate: "2026-01-01", endDate: "2026-12-31" });
    expect(res.totalUsers).toBe(50);
  });
});

describe("admin marketing-dashboard.service - getActivityConversionTrend", () => {
  it("period = month", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      { period: "2026-01", issuedCount: 100, usedCount: 30, uniqueUsers: 25 }
    ]);
    const res = await getActivityConversionTrend({ tenantId, activityId: 1, period: "month" });
    expect(res).toHaveLength(1);
    expect(res[0].usedRate).toBe(30);
  });

  it("period = week", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      { period: "2026-01", issuedCount: 50, usedCount: 20, uniqueUsers: 15 }
    ]);
    const res = await getActivityConversionTrend({ tenantId, activityId: 1, period: "week" });
    expect(res).toHaveLength(1);
  });

  it("period = day（默认）", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      { period: "2026-01-01", issuedCount: 20, usedCount: 5, uniqueUsers: 5 }
    ]);
    const res = await getActivityConversionTrend({ tenantId, activityId: 1 });
    expect(res).toHaveLength(1);
    expect(res[0].usedRate).toBe(25);
  });

  it("返回空数组", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    const res = await getActivityConversionTrend({ tenantId, activityId: 1 });
    expect(res).toEqual([]);
  });

  it("issuedCount 为 0 时 usedRate 为 0", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      { period: "2026-01-01", issuedCount: 0, usedCount: 0, uniqueUsers: 0 }
    ]);
    const res = await getActivityConversionTrend({ tenantId, activityId: 1 });
    expect(res[0].usedRate).toBe(0);
  });
});
