/**
 * 管理端销售报表 service 单元测试
 * 被测文件：src/services/admin/report/sales-report.service.ts
 * 覆盖全部 4 个导出函数，目标覆盖率 100%
 * 注意：该文件在 services/admin/report/ 子目录，mock 路径多一层
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  parseDateParam: vi.fn(),
  getDefaultDateStart: vi.fn(),
  getDefaultDateEnd: vi.fn(),
}));

vi.mock("../../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../../shared/date-utils", () => ({
  parseDateParam: mocks.parseDateParam,
  getDefaultDateStart: mocks.getDefaultDateStart,
  getDefaultDateEnd: mocks.getDefaultDateEnd,
}));

import {
  getSalesDaily,
  getSalesTrend,
  getSalesRanking,
  getSalesSeries,
  getBusinessOverview,
} from "../../../../services/admin/report/sales-report.service";

const tenantId = "t1";

beforeEach(() => {
  vi.resetAllMocks();
  // date-utils 默认返回固定日期
  mocks.getDefaultDateStart.mockReturnValue("2026-06-09");
  mocks.getDefaultDateEnd.mockReturnValue("2026-07-09");
  // parseDateParam: 有值返回值，无值返回 fallback
  mocks.parseDateParam.mockImplementation((value: string, fallback?: string) => value || fallback || "");
});

// ============ getSalesDaily ============
describe("admin report/sales-report.service - getSalesDaily", () => {
  it("storeId 有值 + orderCount > 0（if true + 三元 true）", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ date: "2026-07-09", orderCount: 10, customerCount: 5, salesAmount: 5000, receivedAmount: 4000, unreceivedAmount: 1000 }])
      .mockResolvedValueOnce([{ date: "2026-07-09", returnCount: 2, returnAmount: 500 }]);
    const res = await getSalesDaily(tenantId, "2026-06-09", "2026-07-09", 1);
    expect(res).toHaveLength(1);
    expect(res[0].orderCount).toBe(10);
    expect(res[0].avgOrderAmount).toBe(500);  // 5000/10 = 500
    expect(res[0].returnCount).toBe(2);
    expect(res[0].returnAmount).toBe(500);
  });

  it("storeId 无值 + orderCount = 0（if false + 三元 false）+ 无退货数据", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ date: "2026-07-09", orderCount: 0, customerCount: 0, salesAmount: 0, receivedAmount: 0, unreceivedAmount: 0 }])
      .mockResolvedValueOnce([]);  // 无退货记录 → returnMap 空
    const res = await getSalesDaily(tenantId);
    expect(res).toHaveLength(1);
    expect(res[0].avgOrderAmount).toBe(0);  // orderCount=0 → 三元 false → 0
    expect(res[0].returnCount).toBe(0);     // returnMap 无匹配 → 默认 0
    expect(res[0].returnAmount).toBe(0);
  });
});

// ============ getSalesTrend ============
describe("admin report/sales-report.service - getSalesTrend", () => {
  it("granularity=month", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ period: "2026-07", orderCount: 50, salesAmount: 10000, receivedAmount: 8000 }]);
    const res = await getSalesTrend(tenantId, "month");
    expect(res).toHaveLength(1);
    expect(res[0].period).toBe("2026-07");
  });

  it("granularity=week", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ period: "2026-28", orderCount: 20, salesAmount: 5000, receivedAmount: 4000 }]);
    const res = await getSalesTrend(tenantId, "week");
    expect(res).toHaveLength(1);
  });

  it("granularity=day（默认）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ period: "2026-07-09", orderCount: 5, salesAmount: 1000, receivedAmount: 800 }]);
    const res = await getSalesTrend(tenantId);
    expect(res).toHaveLength(1);
  });

  it("无效 granularity 抛出 ZodError", async () => {
    await expect(getSalesTrend(tenantId, "invalid" as any)).rejects.toThrow();
  });
});

// ============ getSalesSeries（S3-204 需求 1）============
describe("admin report/sales-report.service - getSalesSeries", () => {
  it("dimension=sku + 缺省粒度(month) + 未传日期 ⇒ 走近 12 个月窗口，参数含 dateFormat/targetId", async () => {
    mocks.queryWithTenant.mockResolvedValue([
      { period: "2026-07", qty: 12, amount: 960, orderCount: 3 }
    ]);
    const res = await getSalesSeries(tenantId, { dimension: "sku", targetId: 101 });
    expect(res).toEqual([{ period: "2026-07", qty: 12, amount: 960, orderCount: 3 }]);
    const [sql, params, t] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("12 MONTH");
    expect(sql).toContain("sbi.sku_id = ?");
    expect(sql).toContain("sb.business_status NOT IN ('DRAFT', 'VOIDED')");
    expect(params).toEqual(["%Y-%m", 101]);
    expect(t).toBe(tenantId);
  });

  it("dimension=product ⇒ 经 t_product_sku 反查 SPU（s.spu_id = ?）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ period: "2026-07", qty: "5", amount: "50.50", orderCount: "2" }]);
    const res = await getSalesSeries(tenantId, { dimension: "product", targetId: 7 });
    expect(res[0]).toEqual({ period: "2026-07", qty: 5, amount: 50.5, orderCount: 2 });
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("JOIN t_product_sku s ON s.id = sbi.sku_id AND s.tenant_id = sbi.tenant_id");
    expect(sql).toContain("s.spu_id = ?");
    expect(params).toEqual(["%Y-%m", 7]);
  });

  it("dimension=category ⇒ sku → spu.category_id 反查", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    await getSalesSeries(tenantId, { dimension: "category", targetId: 3 });
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("JOIN t_product_spu sp ON sp.id = s.spu_id AND sp.tenant_id = s.tenant_id");
    expect(sql).toContain("sp.category_id = ?");
    expect(params).toEqual(["%Y-%m", 3]);
  });

  it("dimension=customer ⇒ 直接按 t_sale_bill.customer_id", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    await getSalesSeries(tenantId, { dimension: "customer", targetId: 9 });
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("sb.customer_id = ?");
    expect(params).toEqual(["%Y-%m", 9]);
  });

  it("granularity=day + 传日期区间 ⇒ BETWEEN 模式，窗口按粒度兜底", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    await getSalesSeries(tenantId, {
      dimension: "sku",
      targetId: 1,
      granularity: "day",
      dateStart: "2026-01-01",
      dateEnd: "2026-01-31"
    });
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("DATE(sb.created_at) BETWEEN ? AND ?");
    expect(sql).toContain("DATE_FORMAT(sb.created_at, ?)");
    expect(params).toEqual(["%Y-%m-%d", 1, "2026-01-01", "2026-01-31"]);
  });

  it("只传 dateEnd（缺 dateStart）⇒ dateStart 用粒度窗口兜底，不报错", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    await getSalesSeries(tenantId, { dimension: "sku", targetId: 1, granularity: "week", dateEnd: "2026-07-09" });
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("BETWEEN ? AND ?");
    expect(params).toEqual(["%Y-%u", 1, "2026-06-09", "2026-07-09"]); // getDefaultDateStart mock = 2026-06-09
  });

  it("无数据 ⇒ 返回空数组（不报错）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    await expect(getSalesSeries(tenantId, { dimension: "sku", targetId: 999 })).resolves.toEqual([]);
  });

  it("无效 dimension 抛出 ZodError", async () => {
    await expect(
      getSalesSeries(tenantId, { dimension: "invalid" as any, targetId: 1 })
    ).rejects.toThrow();
  });

  it("targetId 非正整数抛出 ZodError", async () => {
    await expect(getSalesSeries(tenantId, { dimension: "sku", targetId: 0 })).rejects.toThrow();
    await expect(getSalesSeries(tenantId, { dimension: "sku", targetId: NaN })).rejects.toThrow();
  });

  it("无效 granularity 抛出 ZodError", async () => {
    await expect(
      getSalesSeries(tenantId, { dimension: "sku", targetId: 1, granularity: "quarter" as any })
    ).rejects.toThrow();
  });
});

// ============ getSalesRanking ============
describe("admin report/sales-report.service - getSalesRanking", () => {
  it("dimension=product + limit 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, name: "商品A", totalQty: 100, totalAmount: 5000 }]);
    const res = await getSalesRanking(tenantId, "product", "2026-06-09", "2026-07-09", 10);
    expect(res).toHaveLength(1);
    expect(res[0].totalAmount).toBe(5000);
  });

  it("dimension=customer + limit 无值（默认 20）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, name: "客户A", orderCount: 5, totalAmount: 3000, receivedAmount: 2500 }]);
    const res = await getSalesRanking(tenantId, "customer");
    expect(res).toHaveLength(1);
  });

  it("dimension=customer + totalAmount 缺失（?? 右分支）", async () => {
    // 返回数据不包含 totalAmount 字段 → 覆盖 r.totalAmount ?? 0 右分支
    mocks.queryWithTenant.mockResolvedValue([{ id: 2, name: "客户B", orderCount: 3, receivedAmount: 1500 }]);
    const res = await getSalesRanking(tenantId, "customer");
    expect(res).toHaveLength(1);
    expect(res[0].totalAmount).toBe(0);  // totalAmount 缺失 → ?? 0 → 0
  });

  it("dimension=staff（else 分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, name: "员工A", orderCount: 10, totalAmount: 8000, receivedAmount: 7000 }]);
    const res = await getSalesRanking(tenantId, "staff");
    expect(res).toHaveLength(1);
  });

  it("无效 dimension 抛出 ZodError", async () => {
    await expect(getSalesRanking(tenantId, "invalid" as any)).rejects.toThrow();
  });
});

// ============ getBusinessOverview ============
describe("admin report/sales-report.service - getBusinessOverview", () => {
  it("yesterday 有值 + today 有值（增长率计算分支）", async () => {
    // 10 次 queryOneWithTenant: today, yesterday, month, year, receivable, payable, inventory, customer, supplier, monthPurchase
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ amount: 2000, count: 20 })   // todaySales
      .mockResolvedValueOnce({ amount: 1000, count: 10 })   // yesterdaySales
      .mockResolvedValueOnce({ amount: 30000, count: 200 }) // monthSales
      .mockResolvedValueOnce({ amount: 300000, count: 2000 }) // yearSales
      .mockResolvedValueOnce({ amount: 5000 })              // totalReceivable
      .mockResolvedValueOnce({ amount: 8000 })              // totalPayable
      .mockResolvedValueOnce({ amount: 100000 })            // inventoryValue
      .mockResolvedValueOnce({ count: 500 })                // customerCount
      .mockResolvedValueOnce({ count: 50 })                 // supplierCount
      .mockResolvedValueOnce({ amount: 20000, count: 100 });// monthPurchase
    const res = await getBusinessOverview(tenantId);
    expect(res.todaySalesAmount).toBe(2000);
    expect(res.todayOrderCount).toBe(20);
    // (2000-1000)/1000*100 = 100
    expect(res.salesGrowthRate).toBe(100);
    // (20-10)/10*100 = 100
    expect(res.orderGrowthRate).toBe(100);
    expect(res.monthSalesAmount).toBe(30000);
    expect(res.yearSalesAmount).toBe(300000);
    expect(res.totalReceivable).toBe(5000);
    expect(res.totalPayable).toBe(8000);
    expect(res.inventoryValue).toBe(100000);
    expect(res.customerCount).toBe(500);
    expect(res.supplierCount).toBe(50);
    expect(res.monthPurchaseAmount).toBe(20000);
  });

  it("yesterday=0 + today>0（增长率 100 分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ amount: 2000, count: 20 })   // todaySales
      .mockResolvedValueOnce({ amount: 0, count: 0 })       // yesterdaySales → 0
      .mockResolvedValueOnce({ amount: 0, count: 0 })       // monthSales
      .mockResolvedValueOnce({ amount: 0, count: 0 })       // yearSales
      .mockResolvedValueOnce({ amount: 0 })                 // totalReceivable
      .mockResolvedValueOnce({ amount: 0 })                 // totalPayable
      .mockResolvedValueOnce({ amount: 0 })                 // inventoryValue
      .mockResolvedValueOnce({ count: 0 })                  // customerCount
      .mockResolvedValueOnce({ count: 0 })                  // supplierCount
      .mockResolvedValueOnce({ amount: 0, count: 0 });      // monthPurchase
    const res = await getBusinessOverview(tenantId);
    // yesterday=0 + today>0 → 100
    expect(res.salesGrowthRate).toBe(100);
    expect(res.orderGrowthRate).toBe(100);
  });

  it("yesterday=0 + today=0 + 全部 null（增长率 0 分支 + ?? 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getBusinessOverview(tenantId);
    expect(res.todaySalesAmount).toBe(0);
    expect(res.todayOrderCount).toBe(0);
    // yesterday=0 + today=0 → 0
    expect(res.salesGrowthRate).toBe(0);
    expect(res.orderGrowthRate).toBe(0);
    expect(res.monthSalesAmount).toBe(0);
    expect(res.customerCount).toBe(0);
    expect(res.supplierCount).toBe(0);
  });
});
