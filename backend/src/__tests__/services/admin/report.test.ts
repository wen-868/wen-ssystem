/**
 * 管理端报表 service 单元测试
 * 被测文件：src/services/admin/report.service.ts
 * 覆盖全部 20 个导出函数，目标覆盖率 100%
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

import {
  getDashboard,
  getDailySalesTrend,
  getStoreSalesPerformance,
  getInventoryAlerts,
  listInventoryBalance,
  listInventoryLogs,
  listCollectionLinks,
  listPaymentOrders,
  listRefundOrders,
  getCollectionLinkStats,
  revokeCollectionLink,
  getSalesRanking,
  getProductRanking,
  getSalesTrend,
  getPurchaseSummary,
  getPurchaseTrend,
  getSupplierRanking,
  getInventoryTurnover,
  getInventoryAge,
  getInventoryABC,
} from "../../../services/admin/report.service.js";

const tenantId = "t1";

beforeEach(() => {
  vi.resetAllMocks();
});

// ============ getDashboard ============
describe("admin report.service - getDashboard", () => {
  it("全部有值（?? 左分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ amount: 1000, count: 10 })  // sales
      .mockResolvedValueOnce({ amount: 500 })               // pending
      .mockResolvedValueOnce({ count: 20 })                 // orders
      .mockResolvedValueOnce({ count: 3 })                  // warnings
      .mockResolvedValueOnce({ cnt: 5 });                   // pendingOrders
    const res = await getDashboard(tenantId);
    expect(res).toEqual({
      salesAmount: 1000,
      orderCount: 20,
      saleBillCount: 10,
      pendingCollectionAmount: 500,
      inventoryWarningCount: 3,
      pendingOrderCount: 5,
    });
  });

  it("全部 null（?? 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getDashboard(tenantId);
    expect(res).toEqual({
      salesAmount: 0,
      orderCount: 0,
      saleBillCount: 0,
      pendingCollectionAmount: 0,
      inventoryWarningCount: 0,
      pendingOrderCount: 0,
    });
  });
});

// ============ getDailySalesTrend ============
describe("admin report.service - getDailySalesTrend", () => {
  it("返回每日销售趋势", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ date: "2026-07-09", count: 5, amount: 1000 }]);
    const res = await getDailySalesTrend(tenantId);
    expect(res).toEqual([{ date: "2026-07-09", count: 5, amount: 1000 }]);
  });
});

// ============ getStoreSalesPerformance ============
describe("admin report.service - getStoreSalesPerformance", () => {
  it("返回门店销售业绩", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ storeId: 1, storeName: "门店A", totalSales: 5000, billCount: 10 }]);
    const res = await getStoreSalesPerformance(tenantId);
    expect(res).toEqual([{ storeId: 1, storeName: "门店A", totalSales: 5000, billCount: 10 }]);
  });
});

// ============ getInventoryAlerts ============
describe("admin report.service - getInventoryAlerts", () => {
  it("返回库存预警列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ storeId: 1, skuName: "商品A", availableQty: 3 }]);
    const res = await getInventoryAlerts(tenantId);
    expect(res).toHaveLength(1);
  });
});

// ============ listInventoryBalance ============
describe("admin report.service - listInventoryBalance", () => {
  it("keyword + storeId + category 全有值（if 全 true）+ totalRow 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ storeId: 1, skuName: "商品A" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 50 });
    const res = await listInventoryBalance(tenantId, 1, 10, "商品", 1, 5);
    expect(res.total).toBe(50);
    expect(res.records).toHaveLength(1);
    expect(res.page).toBe(1);
    expect(res.pageSize).toBe(10);
  });

  it("keyword + storeId + category 全无值（if 全 false）+ totalRow 为 null（?? 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listInventoryBalance(tenantId, 2, 20, "");
    expect(res.total).toBe(0);
    expect(res.records).toEqual([]);
  });
});

// ============ listInventoryLogs ============
describe("admin report.service - listInventoryLogs", () => {
  it("totalRow 有值（?? 左分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ logNo: "L1", skuName: "商品A" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 100 });
    const res = await listInventoryLogs(tenantId, 1, 10);
    expect(res.total).toBe(100);
  });

  it("totalRow 为 null（?? 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listInventoryLogs(tenantId, 1, 10);
    expect(res.total).toBe(0);
  });
});

// ============ listCollectionLinks ============
describe("admin report.service - listCollectionLinks", () => {
  it("totalRow 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ linkNo: "L1" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 30 });
    const res = await listCollectionLinks(tenantId, 1, 10);
    expect(res.total).toBe(30);
  });

  it("totalRow 为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listCollectionLinks(tenantId, 1, 10);
    expect(res.total).toBe(0);
  });
});

// ============ listPaymentOrders ============
describe("admin report.service - listPaymentOrders", () => {
  it("totalRow 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ payNo: "P1" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 40 });
    const res = await listPaymentOrders(tenantId, 1, 10);
    expect(res.total).toBe(40);
  });

  it("totalRow 为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listPaymentOrders(tenantId, 1, 10);
    expect(res.total).toBe(0);
  });
});

// ============ listRefundOrders ============
describe("admin report.service - listRefundOrders", () => {
  it("totalRow 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ refundNo: "R1" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 5 });
    const res = await listRefundOrders(tenantId, 1, 10);
    expect(res.total).toBe(5);
  });

  it("totalRow 为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listRefundOrders(tenantId, 1, 10);
    expect(res.total).toBe(0);
  });
});

// ============ getCollectionLinkStats ============
describe("admin report.service - getCollectionLinkStats", () => {
  it("total > 0 + paid 有值（paymentRate 计算分支 + ?? 左分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total: 10 })   // total
      .mockResolvedValueOnce({ cnt: 3 })      // paid
      .mockResolvedValueOnce({ cnt: 1 })      // revoked
      .mockResolvedValueOnce({ amount: 5000 });// totalAmount
    mocks.queryWithTenant.mockResolvedValue([{ channel: "WECHAT", cnt: 5 }]); // channels
    const res = await getCollectionLinkStats(tenantId);
    expect(res.total).toBe(10);
    expect(res.paidCount).toBe(3);
    expect(res.revokedCount).toBe(1);
    expect(res.totalPaidAmount).toBe(5000);
    expect(res.paymentRate).toBe("30.0%");
    expect(res.channels).toHaveLength(1);
  });

  it("全部 null（?. null 分支 + ?? 右分支 + paymentRate '0%' 分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([]); // channels
    const res = await getCollectionLinkStats(tenantId);
    expect(res.total).toBe(0);
    expect(res.paidCount).toBe(0);
    expect(res.revokedCount).toBe(0);
    expect(res.totalPaidAmount).toBe(0);
    expect(res.paymentRate).toBe("0%");
    expect(res.channels).toEqual([]);
  });

  it("total > 0 + paid 为 null（paid?.cnt ?. null 分支 + ?? 0 右分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total: 10 })   // total → 有值且 > 0
      .mockResolvedValueOnce(null)              // paid → null（覆盖 paid?.cnt ?. null 分支）
      .mockResolvedValueOnce({ cnt: 1 })      // revoked
      .mockResolvedValueOnce({ amount: 5000 });// totalAmount
    mocks.queryWithTenant.mockResolvedValue([]); // channels
    const res = await getCollectionLinkStats(tenantId);
    expect(res.total).toBe(10);
    expect(res.paidCount).toBe(0);   // paid 为 null → ?? 0 → 0
    expect(res.paymentRate).toBe("0.0%");  // 0/10*100 = 0.0%
  });
});

// ============ revokeCollectionLink ============
describe("admin report.service - revokeCollectionLink", () => {
  it("链接不存在 → 抛出错误", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(revokeCollectionLink("L1", tenantId)).rejects.toThrow("分享链接不存在");
  });

  it("链接已撤销 → 抛出错误", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ link_no: "L1", status: "REVOKED" });
    await expect(revokeCollectionLink("L1", tenantId)).rejects.toThrow("链接已撤销");
  });

  it("链接已支付 → 抛出错误", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ link_no: "L1", status: "PAID" });
    await expect(revokeCollectionLink("L1", tenantId)).rejects.toThrow("已支付的链接不可撤销");
  });

  it("正常撤销成功", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ link_no: "L1", status: "UNPAID" });
    mocks.queryWithTenant.mockResolvedValue(undefined);
    const res = await revokeCollectionLink("L1", tenantId);
    expect(res).toEqual({ linkNo: "L1", status: "REVOKED" });
  });
});

// ============ getSalesRanking ============
describe("admin report.service - getSalesRanking", () => {
  it("startDate + endDate 全有值（if 全 true）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ staffId: 1, staffName: "员工A" }]);
    const res = await getSalesRanking(tenantId, "2026-01-01", "2026-12-31");
    expect(res).toHaveLength(1);
  });

  it("startDate + endDate 全无值（if 全 false）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getSalesRanking(tenantId);
    expect(res).toEqual([]);
  });
});

// ============ getProductRanking ============
describe("admin report.service - getProductRanking", () => {
  it("startDate + endDate 全有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ skuId: 1, skuName: "商品A" }]);
    const res = await getProductRanking(tenantId, "2026-01-01", "2026-12-31");
    expect(res).toHaveLength(1);
  });

  it("startDate + endDate 全无值", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getProductRanking(tenantId);
    expect(res).toEqual([]);
  });
});

// ============ getSalesTrend ============
describe("admin report.service - getSalesTrend", () => {
  it("groupBy=day（默认）+ startDate + endDate 有值（两个 if false + dateFilter if true）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ period: "2026-07-09", count: 5, amount: 1000 }]);
    const res = await getSalesTrend(tenantId, "day", "2026-01-01", "2026-12-31");
    expect(res).toHaveLength(1);
  });

  it("groupBy=week + 无日期（week if true + dateFilter if false）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ period: "2026-28", count: 3, amount: 500 }]);
    const res = await getSalesTrend(tenantId, "week");
    expect(res).toHaveLength(1);
  });

  it("groupBy=month + 无日期（month if true + dateFilter if false）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ period: "2026-07", count: 10, amount: 2000 }]);
    const res = await getSalesTrend(tenantId, "month");
    expect(res).toHaveLength(1);
  });
});

// ============ getPurchaseSummary ============
describe("admin report.service - getPurchaseSummary", () => {
  it("startDate + endDate 全有值（if 全 true）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ totalPurchaseAmount: 10000, orderCount: 5, supplierCount: 2 });
    mocks.queryWithTenant.mockResolvedValue([{ supplierId: 1, supplierName: "供应商A" }]);
    const res = await getPurchaseSummary(tenantId, "2026-01-01", "2026-12-31");
    expect(res.summary.totalPurchaseAmount).toBe(10000);
    expect(res.bySupplier).toHaveLength(1);
  });

  it("startDate + endDate 全无值（if 全 false）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ totalPurchaseAmount: 0, orderCount: 0, supplierCount: 0 });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getPurchaseSummary(tenantId);
    expect(res.bySupplier).toEqual([]);
  });
});

// ============ getPurchaseTrend ============
describe("admin report.service - getPurchaseTrend", () => {
  it("groupBy=month + startDate + endDate 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ period: "2026-07", orderCount: 3, totalAmount: 5000 }]);
    const res = await getPurchaseTrend(tenantId, "month", "2026-01-01", "2026-12-31");
    expect(res).toHaveLength(1);
  });

  it("groupBy=week + 无日期", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ period: "2026-28", orderCount: 2, totalAmount: 3000 }]);
    const res = await getPurchaseTrend(tenantId, "week");
    expect(res).toHaveLength(1);
  });

  it("groupBy=day（默认 else 分支）+ 无日期", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ period: "2026-07-09", orderCount: 1, totalAmount: 1000 }]);
    const res = await getPurchaseTrend(tenantId);
    expect(res).toHaveLength(1);
  });
});

// ============ getSupplierRanking ============
describe("admin report.service - getSupplierRanking", () => {
  it("startDate + endDate 全有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ supplierId: 1, supplierName: "供应商A" }]);
    const res = await getSupplierRanking(tenantId, "2026-01-01", "2026-12-31");
    expect(res).toHaveLength(1);
  });

  it("startDate + endDate 全无值", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getSupplierRanking(tenantId);
    expect(res).toEqual([]);
  });
});

// ============ getInventoryTurnover ============
describe("admin report.service - getInventoryTurnover", () => {
  it("startDate + endDate 全有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ skuId: 1, skuName: "商品A", turnoverRate: 1.5 }]);
    const res = await getInventoryTurnover(tenantId, "2026-01-01", "2026-12-31");
    expect(res).toHaveLength(1);
  });

  it("startDate + endDate 全无值", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getInventoryTurnover(tenantId);
    expect(res).toEqual([]);
  });
});

// ============ getInventoryAge ============
describe("admin report.service - getInventoryAge", () => {
  it("storeId 有值（if true 分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ skuId: 1, skuName: "商品A", ageGroup: "0-30天" }]);
    const res = await getInventoryAge(tenantId, 1);
    expect(res).toHaveLength(1);
  });

  it("storeId 无值（if false 分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getInventoryAge(tenantId);
    expect(res).toEqual([]);
  });
});

// ============ getInventoryABC ============
describe("admin report.service - getInventoryABC", () => {
  it("覆盖 A/B/C 三类分类（grandTotal > 0）", async () => {
    // 3 个商品，总销售额 100，累积占比 70%/90%/100% → A/B/C
    mocks.queryWithTenant.mockResolvedValue([
      { skuId: 1, skuName: "商品A", totalSales: 70 },
      { skuId: 2, skuName: "商品B", totalSales: 20 },
      { skuId: 3, skuName: "商品C", totalSales: 10 },
    ]);
    const res = await getInventoryABC(tenantId);
    expect(res).toHaveLength(3);
    expect(res[0].category).toBe("A");  // 70% → pct=0.7 ≤ 0.7 → A
    expect(res[1].category).toBe("B");  // 90% → pct=0.9 ≤ 0.9 → B
    expect(res[2].category).toBe("C");  // 100% → pct=1.0 > 0.9 → C
    expect(res[0].cumulativePct).toBe(70);
  });

  it("grandTotal === 0（grandTotal > 0 三元 false 分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ skuId: 1, skuName: "商品A", totalSales: 0 }]);
    const res = await getInventoryABC(tenantId);
    expect(res).toHaveLength(1);
    expect(res[0].cumulativePct).toBe(0);
    expect(res[0].category).toBe("A");  // pct=0 ≤ 0.7 → A
  });
});
