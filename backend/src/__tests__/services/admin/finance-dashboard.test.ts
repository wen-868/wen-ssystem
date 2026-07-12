/**
 * 管理端财务仪表盘 service 单元测试
 * 被测文件：src/services/admin/finance-dashboard.service.ts
 * 覆盖全部 7 个导出函数，目标覆盖率 100%
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
  getFinanceDashboard,
  getDailyReport,
  getMonthlyReport,
  getCashFlow,
  getProfitTrend,
  getTopCustomersAR,
  getTopSuppliersAP,
} from "../../../services/admin/finance-dashboard.service";

beforeEach(() => {
  mocks.queryWithTenant.mockReset();
  mocks.queryOneWithTenant.mockReset();
});

// ============ getFinanceDashboard ============
describe("admin finance-dashboard.service - getFinanceDashboard", () => {
  it("全部有值（?? 左分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total: 1000 })  // monthIncome
      .mockResolvedValueOnce({ total: 500 })   // monthExpense
      .mockResolvedValueOnce({ total: 800 })   // totalAR
      .mockResolvedValueOnce({ total: 600 })   // totalAP
      .mockResolvedValueOnce({ total: 300 });  // monthPayment
    const res = await getFinanceDashboard("t1");
    expect(res).toEqual({
      monthIncome: 1000,
      monthExpense: 500,
      monthPayment: 300,
      monthProfit: 500,
      totalAR: 800,
      totalAP: 600,
    });
  });

  it("全部 null（?? 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getFinanceDashboard("t1");
    expect(res).toEqual({
      monthIncome: 0,
      monthExpense: 0,
      monthPayment: 0,
      monthProfit: 0,
      totalAR: 0,
      totalAP: 0,
    });
  });
});

// ============ getDailyReport ============
describe("admin finance-dashboard.service - getDailyReport", () => {
  it("有 startDate + endDate（if 左分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ date: "2026-07-01", income: 1000 }]);
    const res = await getDailyReport("t1", "2026-07-01", "2026-07-31");
    expect(res).toEqual([{ date: "2026-07-01", income: 1000 }]);
  });

  it("无 startDate + 无 endDate（if 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getDailyReport("t1");
    expect(res).toEqual([]);
  });
});

// ============ getMonthlyReport ============
describe("admin finance-dashboard.service - getMonthlyReport", () => {
  it("有 year（?? 左分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ month: "2026-07", income: 1000 }]);
    const res = await getMonthlyReport("t1", 2026);
    expect(res).toEqual([{ month: "2026-07", income: 1000 }]);
  });

  it("无 year（?? 右分支，使用当前年份）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getMonthlyReport("t1");
    expect(res).toEqual([]);
  });
});

// ============ getCashFlow ============
describe("admin finance-dashboard.service - getCashFlow", () => {
  it("全部有值（?? 左分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total: 1000 })  // income
      .mockResolvedValueOnce({ total: 500 })   // expense
      .mockResolvedValueOnce({ total: 300 });  // payment
    const res = await getCashFlow("t1", 1);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      month: expect.any(String),
      income: 1000,
      expense: 500,
      payment: 300,
      netCashFlow: 200,
    });
  });

  it("全部 null（?? 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getCashFlow("t1", 1);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      month: expect.any(String),
      income: 0,
      expense: 0,
      payment: 0,
      netCashFlow: 0,
    });
  });
});

// ============ getProfitTrend ============
describe("admin finance-dashboard.service - getProfitTrend", () => {
  it("全部有值（?? 左分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total: 1000 })  // income
      .mockResolvedValueOnce({ total: 500 });  // expense
    const res = await getProfitTrend("t1", 1);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      month: expect.any(String),
      income: 1000,
      expense: 500,
      profit: 500,
    });
  });

  it("全部 null（?? 右分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getProfitTrend("t1", 1);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      month: expect.any(String),
      income: 0,
      expense: 0,
      profit: 0,
    });
  });
});

// ============ getTopCustomersAR ============
describe("admin finance-dashboard.service - getTopCustomersAR", () => {
  it("返回 top 客户应收列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ customerId: 1, customerName: "张三", totalAR: 5000 }]);
    const res = await getTopCustomersAR("t1");
    expect(res).toEqual([{ customerId: 1, customerName: "张三", totalAR: 5000 }]);
  });
});

// ============ getTopSuppliersAP ============
describe("admin finance-dashboard.service - getTopSuppliersAP", () => {
  it("返回 top 供应商应付列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ supplierId: 1, supplierName: "供应商A", totalAP: 3000 }]);
    const res = await getTopSuppliersAP("t1");
    expect(res).toEqual([{ supplierId: 1, supplierName: "供应商A", totalAP: 3000 }]);
  });
});
