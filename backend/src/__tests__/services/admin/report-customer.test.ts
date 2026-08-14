/**
 * 管理端客户报表 service 单元测试
 * 被测文件：src/services/admin/report-customer.service.ts
 * 覆盖全部 6 个导出函数，目标覆盖率 100%
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
  getRepurchaseAnalysis,
  getAvgOrderValueDistribution,
  getRFMAnalysis,
  getCustomerContributionRanking,
  getNewCustomerTrend,
  getLostCustomerAnalysis,
} from "../../../services/admin/report-customer.service";

const tenantId = "t1";

beforeEach(() => {
  vi.resetAllMocks();
});

// ============ getRepurchaseAnalysis ============
describe("admin report-customer.service - getRepurchaseAnalysis", () => {
  it("完整 params + 全部有值（if 全 true + totalC>0 + totalO>0 三元 true）", async () => {
    // 4 次 queryOneWithTenant + 1 次 queryWithTenant
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ cnt: 100 })  // totalCustomers
      .mockResolvedValueOnce({ cnt: 30 })   // repurchaseCustomers
      .mockResolvedValueOnce({ cnt: 200 })  // totalOrders
      .mockResolvedValueOnce({ cnt: 60 });  // repurchaseOrders
    mocks.queryWithTenant.mockResolvedValue([{ month: "2026-07", totalCustomers: 100, repurchaseCustomers: 30 }]);
    const res = await getRepurchaseAnalysis({
      tenantId, startDate: "2026-01-01", endDate: "2026-12-31", storeId: 1,
    });
    expect(res.repurchaseRate).toBe(30);
    expect(res.repurchaseCustomerCount).toBe(30);
    expect(res.totalCustomerCount).toBe(100);
    expect(res.repurchaseOrderCount).toBe(60);
    expect(res.totalOrderCount).toBe(200);
    expect(res.repurchaseOrderRate).toBe(30);
    expect(res.trend).toHaveLength(1);
  });

  it("仅 tenantId + 全部 null（if 全 false + totalC=0 + totalO=0 三元 false）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getRepurchaseAnalysis({ tenantId });
    expect(res.repurchaseRate).toBe(0);
    expect(res.repurchaseCustomerCount).toBe(0);
    expect(res.totalCustomerCount).toBe(0);
    expect(res.repurchaseOrderCount).toBe(0);
    expect(res.totalOrderCount).toBe(0);
    expect(res.repurchaseOrderRate).toBe(0);
    expect(res.trend).toEqual([]);
  });
});

// ============ getAvgOrderValueDistribution ============
describe("admin report-customer.service - getAvgOrderValueDistribution", () => {
  it("完整 params + totalOrders > 0（if 全 true + pct 三元 true）", async () => {
    // avgOrderValue + 6 个 intervals + total = 8 次 queryOneWithTenant
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ avgValue: 250 })  // avgOrderValue
      .mockResolvedValueOnce({ orderCount: 5, customerCount: 3, totalAmount: 500 })   // <100
      .mockResolvedValueOnce({ orderCount: 10, customerCount: 6, totalAmount: 2000 }) // 100-300
      .mockResolvedValueOnce({ orderCount: 8, customerCount: 5, totalAmount: 3200 })  // 300-500
      .mockResolvedValueOnce({ orderCount: 4, customerCount: 3, totalAmount: 2800 })  // 500-1000
      .mockResolvedValueOnce({ orderCount: 2, customerCount: 2, totalAmount: 4000 })  // 1000-3000
      .mockResolvedValueOnce({ orderCount: 1, customerCount: 1, totalAmount: 3500 })  // 3000+
      .mockResolvedValueOnce({ cnt: 30 });  // total
    const res = await getAvgOrderValueDistribution({
      tenantId, startDate: "2026-01-01", endDate: "2026-12-31", storeId: 1,
    });
    expect(res.avgOrderValue).toBe(250);
    expect(res.totalOrders).toBe(30);
    expect(res.distribution).toHaveLength(6);
    // 第一个区间 5/30 = 16.67%
    expect(res.distribution[0].pct).toBe(16.67);
  });

  it("仅 tenantId + 全部 null + totalOrders = 0（if 全 false + ?? 右分支 + pct 三元 false）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getAvgOrderValueDistribution({ tenantId });
    expect(res.avgOrderValue).toBe(0);
    expect(res.totalOrders).toBe(0);
    expect(res.distribution).toHaveLength(6);
    expect(res.distribution[0].pct).toBe(0);
  });
});

// ============ getRFMAnalysis ============
describe("admin report-customer.service - getRFMAnalysis", () => {
  it("rfm 为空 → 早返回（rfm.length === 0 分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getRFMAnalysis({ tenantId });
    expect(res).toEqual({ groups: [], totalCustomers: 0 });
  });

  it("9 个客户覆盖 8 种 RFM 分类 + storeId 有值", async () => {
    // 构造 9 个客户数据，覆盖 8 种 rScore/fScore/mScore 组合
    // 中位数计算：sortedR[4], sortedF[4], sortedM[4]
    // recencyDays 升序: [1,2,3,4,5,10,11,12,13] → rMid=5
    // frequency 降序: [10,9,8,7,6,4,3,2,1] → fMid=6
    // monetary 降序: [100,90,80,70,60,40,30,20,10] → mMid=60
    mocks.queryWithTenant.mockResolvedValue([
      { customerId: 1, customerName: "A", recencyDays: 1, frequency: 10, monetary: 100 },   // 2,2,2 重要价值
      { customerId: 2, customerName: "B", recencyDays: 2, frequency: 1, monetary: 90 },     // 2,1,2 重要发展
      { customerId: 3, customerName: "C", recencyDays: 10, frequency: 9, monetary: 80 },    // 1,2,2 重要保持
      { customerId: 4, customerName: "D", recencyDays: 11, frequency: 2, monetary: 70 },    // 1,1,2 重要挽留
      { customerId: 5, customerName: "E", recencyDays: 3, frequency: 8, monetary: 10 },     // 2,2,1 一般价值
      { customerId: 6, customerName: "F", recencyDays: 4, frequency: 3, monetary: 20 },     // 2,1,1 一般发展
      { customerId: 7, customerName: "G", recencyDays: 12, frequency: 7, monetary: 30 },    // 1,2,1 一般保持
      { customerId: 8, customerName: "H", recencyDays: 13, frequency: 4, monetary: 40 },    // 1,1,1 一般挽留
      { customerId: 9, customerName: "I", recencyDays: 5, frequency: 6, monetary: 60 },     // 2,2,2 重复
    ]);
    const res = await getRFMAnalysis({ tenantId, storeId: 1 });
    expect(res.totalCustomers).toBe(9);
    // 检查 8 种分组都存在
    const groupNames = res.groups.map((g: any) => g.rfmGroup);
    expect(groupNames).toContain("重要价值客户");
    expect(groupNames).toContain("重要发展客户");
    expect(groupNames).toContain("重要保持客户");
    expect(groupNames).toContain("重要挽留客户");
    expect(groupNames).toContain("一般价值客户");
    expect(groupNames).toContain("一般发展客户");
    expect(groupNames).toContain("一般保持客户");
    expect(groupNames).toContain("一般挽留客户");
    // customers 数组包含 rScore/fScore/mScore
    expect(res.customers).toHaveLength(9);
  });
});

// ============ getCustomerContributionRanking ============
describe("admin report-customer.service - getCustomerContributionRanking", () => {
  it("完整 params（if 全 true）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ customerId: 1, customerName: "张三", totalAmount: 5000 }]);
    const res = await getCustomerContributionRanking({
      tenantId, startDate: "2026-01-01", endDate: "2026-12-31", storeId: 1, limit: 10,
    });
    expect(res).toHaveLength(1);
  });

  it("仅 tenantId（if 全 false + 默认 limit）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getCustomerContributionRanking({ tenantId });
    expect(res).toEqual([]);
  });
});

// ============ getNewCustomerTrend ============
describe("admin report-customer.service - getNewCustomerTrend", () => {
  it("groupBy=month + storeId 有值（month 分支 + storeCondition true）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ period: "2026-07", newCustomerCount: 10 }]);
    const res = await getNewCustomerTrend({ tenantId, groupBy: "month", storeId: 1 });
    expect(res).toHaveLength(1);
  });

  it("groupBy=week + 无 storeId（week 分支 + storeCondition false）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ period: "2026-28", newCustomerCount: 5 }]);
    const res = await getNewCustomerTrend({ tenantId, groupBy: "week" });
    expect(res).toHaveLength(1);
  });

  it("groupBy=day + 无 storeId（day 默认分支 + storeCondition false）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ period: "2026-07-09", newCustomerCount: 3 }]);
    const res = await getNewCustomerTrend({ tenantId });
    expect(res).toHaveLength(1);
  });
});

// ============ getLostCustomerAnalysis ============
describe("admin report-customer.service - getLostCustomerAnalysis", () => {
  it("storeId 有值 + total > 0（storeCondition true + lostRate 三元 true）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ cnt: 50 });  // totalCustomers
    mocks.queryWithTenant.mockResolvedValue([
      { customerId: 1, customerName: "张三", daysSinceLastOrder: 100 },
    ]);
    const res = await getLostCustomerAnalysis({ tenantId, daysThreshold: 90, storeId: 1 });
    expect(res.totalCustomers).toBe(50);
    expect(res.lostCustomerCount).toBe(1);
    expect(res.lostRate).toBe(2);  // 1/50 * 100 = 2
    expect(res.daysThreshold).toBe(90);
    expect(res.customers).toHaveLength(1);
  });

  it("storeId 无值 + total = 0（storeCondition false + lostRate 三元 false）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);  // totalCustomers null → 0
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getLostCustomerAnalysis({ tenantId });
    expect(res.totalCustomers).toBe(0);
    expect(res.lostCustomerCount).toBe(0);
    expect(res.lostRate).toBe(0);
    expect(res.daysThreshold).toBe(90);  // 默认值
  });
});
