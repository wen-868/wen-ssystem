/**
 * 管理端仪表盘 service 单元测试
 * 被测文件：src/services/admin/dashboard.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

import {
  getOverview,
  getSalesTrend,
  getCategoryPie,
  getTopProducts,
  getTopCustomers,
  getRecentAlerts,
  getTodos,
  getRecentOrders,
  getSalesTrendByDay,
} from "../../../services/admin/dashboard.service";

describe("dashboard.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("getOverview", () => {
    it("返回完整概览数据（含环比计算）", async () => {
      // getOverview 优化后合并为 5 个 queryOne 调用
      // 1. 销售统计（合并今日/昨日/本月/上月/本年 + 应收账款）
      mocks.queryOne.mockResolvedValueOnce({
        todaySalesAmount: 1000, todayOrderCount: 10, todayReceivedAmount: 800,
        yesterdaySalesAmount: 500, yesterdayOrderCount: 5,
        monthSalesAmount: 20000, monthOrderCount: 200, monthReceivedAmount: 15000,
        lastMonthSalesAmount: 10000, lastMonthOrderCount: 100,
        yearSalesAmount: 100000, yearOrderCount: 1000, yearReceivedAmount: 80000,
        receivableAmount: 2000,
      });
      // 2. 采购统计（合并今日/本月/本年 + 应付账款）
      mocks.queryOne.mockResolvedValueOnce({
        todayPurchaseAmount: 300, todayPurchaseOrderCount: 3,
        monthPurchaseAmount: 5000, monthPurchaseOrderCount: 50,
        yearPurchaseAmount: 50000, yearPurchaseOrderCount: 500,
        payableAmount: 1000,
      });
      // 3. 待处理订单（合并当前/昨日）
      mocks.queryOne.mockResolvedValueOnce({ currentPendingCount: 5, yesterdayPendingCount: 2 });
      // 4. 库存预警（合并总数/紧急）
      mocks.queryOne.mockResolvedValueOnce({ totalAlerts: 3, urgentAlerts: 1 });
      // 5. 库存价值
      mocks.queryOne.mockResolvedValueOnce({ amount: 5000, skuCount: 50 });

      const res = await getOverview("t1");
      expect(res.today.salesAmount).toBe(1000);
      expect(res.today.orderCount).toBe(10);
      // (1000-500)/500*100 = 100
      expect(res.today.compareYesterday.salesAmountChange).toBe(100);
      expect(res.today.compareYesterday.orderCountChange).toBe(5);
      expect(res.month.salesAmount).toBe(20000);
      expect(res.month.compareLastMonth.salesAmountChange).toBe(100);
      expect(res.pending.orderCount).toBe(5);
      expect(res.pending.changeFromYesterday).toBe(3);
      expect(res.stockAlerts.total).toBe(3);
      expect(res.stockAlerts.urgent).toBe(1);
      expect(res.inventory.skuCount).toBe(50);
      expect(res.finance.receivable).toBe(2000);
    });

    it("数据库返回 null 时全部归零", async () => {
      mocks.queryOne.mockResolvedValue(null);
      const res = await getOverview("t1");
      expect(res.today.salesAmount).toBe(0);
      expect(res.today.compareYesterday.salesAmountChange).toBe(0);
      expect(res.month.salesAmount).toBe(0);
      expect(res.year.salesAmount).toBe(0);
      expect(res.pending.orderCount).toBe(0);
      expect(res.stockAlerts.total).toBe(0);
    });

    it("昨日销售额为 0 时环比变化为 0", async () => {
      mocks.queryOne.mockResolvedValueOnce({
        todaySalesAmount: 100, todayOrderCount: 1, todayReceivedAmount: 50,
        yesterdaySalesAmount: 0, yesterdayOrderCount: 0,
        monthSalesAmount: 0, monthOrderCount: 0, monthReceivedAmount: 0,
        lastMonthSalesAmount: 0, lastMonthOrderCount: 0,
        yearSalesAmount: 0, yearOrderCount: 0, yearReceivedAmount: 0,
        receivableAmount: 0,
      });
      mocks.queryOne.mockResolvedValueOnce({
        todayPurchaseAmount: 0, todayPurchaseOrderCount: 0,
        monthPurchaseAmount: 0, monthPurchaseOrderCount: 0,
        yearPurchaseAmount: 0, yearPurchaseOrderCount: 0,
        payableAmount: 0,
      });
      mocks.queryOne.mockResolvedValueOnce({ currentPendingCount: 0, yesterdayPendingCount: 0 });
      mocks.queryOne.mockResolvedValueOnce({ totalAlerts: 0, urgentAlerts: 0 });
      mocks.queryOne.mockResolvedValueOnce({ amount: 0, skuCount: 0 });
      const res = await getOverview("t1");
      expect(res.today.compareYesterday.salesAmountChange).toBe(0);
      expect(res.today.compareYesterday.orderCountChange).toBe(0);
    });
  });

  describe("getSalesTrend", () => {
    it("返回月度趋势并转换为数字", async () => {
      mocks.query.mockResolvedValue([
        { month: "2026-01", salesAmount: "1000", receivedAmount: "800", orderCount: "10" },
      ]);
      const res = await getSalesTrend("t1");
      expect(res.length).toBe(1);
      expect(res[0].salesAmount).toBe(1000);
      expect(res[0].orderCount).toBe(10);
    });

    it("无数据时返回空数组", async () => {
      mocks.query.mockResolvedValue([]);
      const res = await getSalesTrend("t1");
      expect(res).toEqual([]);
    });
  });

  describe("getCategoryPie", () => {
    it("返回分类占比（含百分比）", async () => {
      mocks.query.mockResolvedValue([
        { categoryName: "白酒", totalAmount: "800", totalQty: "8" },
        { categoryName: "啤酒", totalAmount: "200", totalQty: "2" },
      ]);
      const res = await getCategoryPie("t1", "2026-01-01", "2026-01-31");
      expect(res.length).toBe(2);
      expect(res[0].percentage).toBe(80);
      expect(res[1].percentage).toBe(20);
    });

    it("总额为 0 时百分比 0", async () => {
      mocks.query.mockResolvedValue([{ categoryName: "x", totalAmount: "0", totalQty: "0" }]);
      const res = await getCategoryPie("t1", "2026-01-01", "2026-01-31");
      expect(res[0].percentage).toBe(0);
    });
  });

  describe("getTopProducts", () => {
    it("返回热销商品列表", async () => {
      mocks.query.mockResolvedValue([{ skuId: 1, skuName: "茅台", totalQty: "10", totalAmount: "5000", orderCount: "5" }]);
      const res = await getTopProducts("t1", "2026-01-01", "2026-01-31");
      expect(res[0].skuName).toBe("茅台");
      expect(res[0].totalAmount).toBe(5000);
    });
  });

  describe("getTopCustomers", () => {
    it("返回 top 客户", async () => {
      mocks.query.mockResolvedValue([{ customerId: 1, customerName: "客户A", orderCount: "3", totalAmount: "1000", receivedAmount: "800" }]);
      const res = await getTopCustomers("t1", "2026-01-01", "2026-01-31");
      expect(res[0].customerName).toBe("客户A");
      expect(res[0].totalAmount).toBe(1000);
    });
  });

  describe("getRecentAlerts", () => {
    it("返回告警列表", async () => {
      mocks.query.mockResolvedValue([{ id: 1, alertNo: "A1" }]);
      const res = await getRecentAlerts("t1", 5);
      expect(res.length).toBe(1);
      const [, params] = mocks.query.mock.calls[0];
      expect(params).toEqual(["t1", 5]);
    });
  });

  describe("getTodos", () => {
    it("无待办时返回空 items", async () => {
      mocks.queryOne.mockResolvedValue({ count: 0 });
      mocks.query.mockResolvedValue([]);
      const res = await getTodos("t1");
      expect(res.total).toBe(0);
      expect(res.items).toEqual([]);
    });

    it("有待付款订单时加入 items", async () => {
      mocks.queryOne.mockResolvedValueOnce({ count: 3, earliest: "2026-01-01T00:00:00Z" }); // pendingPayment
      mocks.queryOne.mockResolvedValueOnce({ count: 0 }); // pendingDelivery
      mocks.queryOne.mockResolvedValueOnce({ count: 0 }); // delivering
      mocks.query.mockResolvedValueOnce([]); // stockWarnings
      mocks.query.mockResolvedValueOnce([]); // overdueReceivables
      const res = await getTodos("t1");
      expect(res.total).toBe(1);
      expect(res.items[0].type).toBe("pending_payment");
      expect(res.items[0].priority).toBe("urgent");
      expect(res.items[0].count).toBe(3);
    });

    it("有库存预警时加入 items 并标记紧急", async () => {
      mocks.queryOne.mockResolvedValueOnce({ count: 0 });
      mocks.queryOne.mockResolvedValueOnce({ count: 0 });
      mocks.queryOne.mockResolvedValueOnce({ count: 0 });
      mocks.query.mockResolvedValueOnce([
        { skuName: "茅台", currentStock: 1, warningLevel: "URGENT" },
        { skuName: "五粮液", currentStock: 2, warningLevel: "WARNING" },
      ]);
      mocks.query.mockResolvedValueOnce([]);
      const res = await getTodos("t1");
      expect(res.total).toBe(1);
      expect(res.items[0].type).toBe("stock_warning");
      expect(res.items[0].subtitle).toContain("1项紧急");
    });
  });

  describe("getRecentOrders", () => {
    it("返回最近订单并附带状态标签", async () => {
      mocks.query.mockResolvedValue([{ orderNo: "O1", customerName: "C", amount: "100", orderStatus: "COMPLETED", createdAt: "2026-01-01" }]);
      const res = await getRecentOrders("t1", 5);
      expect(res[0].statusLabel).toBe("已完成");
    });

    it("未知状态标签返回原值", async () => {
      mocks.query.mockResolvedValue([{ orderNo: "O1", customerName: "C", amount: null, orderStatus: "UNKNOWN", createdAt: null }]);
      const res = await getRecentOrders("t1");
      expect(res[0].statusLabel).toBe("UNKNOWN");
      expect(res[0].amount).toBe(0);
    });
  });

  describe("getSalesTrendByDay", () => {
    it("返回按日趋势", async () => {
      mocks.query.mockResolvedValue([{ date: "2026-01-01", salesAmount: "500", orderCount: "5" }]);
      const res = await getSalesTrendByDay("t1", 7);
      expect(res[0].salesAmount).toBe(500);
      expect(res[0].orderCount).toBe(5);
      const [, params] = mocks.query.mock.calls[0];
      expect(params).toEqual(["t1", 7]);
    });

    it("未传 days 时默认 7", async () => {
      mocks.query.mockResolvedValue([]);
      await getSalesTrendByDay("t1");
      const [, params] = mocks.query.mock.calls[0];
      expect(params).toEqual(["t1", 7]);
    });
  });
});
