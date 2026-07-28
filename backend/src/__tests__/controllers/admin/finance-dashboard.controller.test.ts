/**
 * 财务看板 controller 单元测试
 * 被测文件：src/controllers/admin/finance-dashboard.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../services/admin/finance-dashboard.service", () => ({
  getFinanceDashboard: vi.fn(),
  getDailyReport: vi.fn(),
  getMonthlyReport: vi.fn(),
  getCashFlow: vi.fn(),
  getProfitTrend: vi.fn(),
  getTopCustomersAR: vi.fn(),
  getTopSuppliersAP: vi.fn(),
  getCashFlowDetail: vi.fn(),
  getIncomeExpenseStats: vi.fn(),
  getIncomeByCategory: vi.fn(),
  getExpenseByCategory: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as svc from "../../../services/admin/finance-dashboard.service";
import { ok } from "../../../shared/response";
import {
  getFinanceDashboard,
  getDailyReport,
  getMonthlyReport,
  getCashFlow,
  getProfitTrend,
  getTopCustomersAR,
  getTopSuppliersAP,
  getCashFlowDetail,
  getIncomeExpenseStats,
  getIncomeByCategory,
  getExpenseByCategory,
} from "../../../controllers/admin/finance-dashboard.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1 },
  headers: {},
  query: {},
  params: {},
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  res.send = vi.fn();
  return res;
};

describe("admin/finance-dashboard.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getFinanceDashboard", () => {
    it("获取财务看板总览", async () => {
      (svc.getFinanceDashboard as any).mockResolvedValue({ totalRevenue: 10000 });
      const req = mockReq({});
      const res = mockRes();
      await getFinanceDashboard(req as any, res as any, vi.fn());
      expect(svc.getFinanceDashboard).toHaveBeenCalledWith("t1");
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("getDailyReport", () => {
    it("获取日报表（带日期）", async () => {
      (svc.getDailyReport as any).mockResolvedValue({ revenue: 1000 });
      const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-01-31" } });
      const res = mockRes();
      await getDailyReport(req as any, res as any, vi.fn());
      expect(svc.getDailyReport).toHaveBeenCalledWith("t1", "2026-01-01", "2026-01-31");
      expect(ok).toHaveBeenCalled();
    });

    it("获取日报表（不带日期）", async () => {
      (svc.getDailyReport as any).mockResolvedValue({ revenue: 0 });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await getDailyReport(req as any, res as any, vi.fn());
      expect(svc.getDailyReport).toHaveBeenCalledWith("t1", undefined, undefined);
    });
  });

  describe("getMonthlyReport", () => {
    it("获取月报表（带年份）", async () => {
      (svc.getMonthlyReport as any).mockResolvedValue({ revenue: 30000 });
      const req = mockReq({ query: { year: "2026" } });
      const res = mockRes();
      await getMonthlyReport(req as any, res as any, vi.fn());
      expect(svc.getMonthlyReport).toHaveBeenCalledWith("t1", 2026);
      expect(ok).toHaveBeenCalled();
    });

    it("获取月报表（不带年份）", async () => {
      (svc.getMonthlyReport as any).mockResolvedValue({ revenue: 0 });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await getMonthlyReport(req as any, res as any, vi.fn());
      expect(svc.getMonthlyReport).toHaveBeenCalledWith("t1", undefined);
    });
  });

  describe("getCashFlow", () => {
    it("获取现金流（指定月数）", async () => {
      (svc.getCashFlow as any).mockResolvedValue({ inflow: 10000 });
      const req = mockReq({ query: { months: "6" } });
      const res = mockRes();
      await getCashFlow(req as any, res as any, vi.fn());
      expect(svc.getCashFlow).toHaveBeenCalledWith("t1", 6);
      expect(ok).toHaveBeenCalled();
    });

    it("获取现金流（默认12个月）", async () => {
      (svc.getCashFlow as any).mockResolvedValue({ inflow: 0 });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await getCashFlow(req as any, res as any, vi.fn());
      expect(svc.getCashFlow).toHaveBeenCalledWith("t1", 12);
    });
  });

  describe("getProfitTrend", () => {
    it("获取利润趋势（指定月数）", async () => {
      (svc.getProfitTrend as any).mockResolvedValue({ trend: [] });
      const req = mockReq({ query: { months: "3" } });
      const res = mockRes();
      await getProfitTrend(req as any, res as any, vi.fn());
      expect(svc.getProfitTrend).toHaveBeenCalledWith("t1", 3);
      expect(ok).toHaveBeenCalled();
    });

    it("获取利润趋势（默认12个月）", async () => {
      (svc.getProfitTrend as any).mockResolvedValue({ trend: [] });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await getProfitTrend(req as any, res as any, vi.fn());
      expect(svc.getProfitTrend).toHaveBeenCalledWith("t1", 12);
    });
  });

  describe("getTopCustomersAR", () => {
    it("获取应收Top客户（指定limit）", async () => {
      (svc.getTopCustomersAR as any).mockResolvedValue([]);
      const req = mockReq({ query: { limit: "5" } });
      const res = mockRes();
      await getTopCustomersAR(req as any, res as any, vi.fn());
      expect(svc.getTopCustomersAR).toHaveBeenCalledWith("t1", 5);
      expect(ok).toHaveBeenCalled();
    });

    it("获取应收Top客户（默认10）", async () => {
      (svc.getTopCustomersAR as any).mockResolvedValue([]);
      const req = mockReq({ query: {} });
      const res = mockRes();
      await getTopCustomersAR(req as any, res as any, vi.fn());
      expect(svc.getTopCustomersAR).toHaveBeenCalledWith("t1", 10);
    });
  });

  describe("getTopSuppliersAP", () => {
    it("获取应付Top供应商（指定limit）", async () => {
      (svc.getTopSuppliersAP as any).mockResolvedValue([]);
      const req = mockReq({ query: { limit: "5" } });
      const res = mockRes();
      await getTopSuppliersAP(req as any, res as any, vi.fn());
      expect(svc.getTopSuppliersAP).toHaveBeenCalledWith("t1", 5);
      expect(ok).toHaveBeenCalled();
    });

    it("获取应付Top供应商（默认10）", async () => {
      (svc.getTopSuppliersAP as any).mockResolvedValue([]);
      const req = mockReq({ query: {} });
      const res = mockRes();
      await getTopSuppliersAP(req as any, res as any, vi.fn());
      expect(svc.getTopSuppliersAP).toHaveBeenCalledWith("t1", 10);
    });
  });

  describe("getCashFlowDetail", () => {
    it("获取现金流明细", async () => {
      (svc.getCashFlowDetail as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { type: "INCOME", page: "1", pageSize: "20" } });
      const res = mockRes();
      await getCashFlowDetail(req as any, res as any, vi.fn());
      expect(svc.getCashFlowDetail).toHaveBeenCalledWith(expect.objectContaining({
        type: "INCOME",
        page: 1,
        pageSize: 20,
      }));
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("getIncomeExpenseStats", () => {
    it("获取收支统计", async () => {
      (svc.getIncomeExpenseStats as any).mockResolvedValue({ income: 10000, expense: 5000 });
      const req = mockReq({ query: { startDate: "2026-01-01" } });
      const res = mockRes();
      await getIncomeExpenseStats(req as any, res as any, vi.fn());
      expect(svc.getIncomeExpenseStats).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("getIncomeByCategory", () => {
    it("按类别获取收入", async () => {
      (svc.getIncomeByCategory as any).mockResolvedValue({ categories: [] });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await getIncomeByCategory(req as any, res as any, vi.fn());
      expect(svc.getIncomeByCategory).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("getExpenseByCategory", () => {
    it("按类别获取支出", async () => {
      (svc.getExpenseByCategory as any).mockResolvedValue({ categories: [] });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await getExpenseByCategory(req as any, res as any, vi.fn());
      expect(svc.getExpenseByCategory).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });
});
