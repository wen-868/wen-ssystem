import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/finance-dashboard.service", () => ({
  getFinanceDashboard: vi.fn(),
  getDailyReport: vi.fn(),
  getMonthlyReport: vi.fn(),
  getCashFlow: vi.fn(),
  getProfitTrend: vi.fn(),
  getTopCustomersAR: vi.fn(),
  getTopSuppliersAP: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as financeDashboardService from "../../../services/admin/finance-dashboard.service";
import { ok } from "../../../shared/response";
import {
  getFinanceDashboard,
  getDailyReport,
  getMonthlyReport,
  getCashFlow,
  getProfitTrend,
  getTopCustomersAR,
  getTopSuppliersAP,
} from "../../../controllers/admin/finance-dashboard.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
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

describe("finance-dashboard.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getFinanceDashboard - 应返回财务看板数据", async () => {
    (financeDashboardService.getFinanceDashboard as any).mockResolvedValue({ revenue: 10000 });
    const req = mockReq();
    const res = mockRes();
    await getFinanceDashboard(req as any, res as any);
    expect(financeDashboardService.getFinanceDashboard).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalledWith({ revenue: 10000 });
  });

  it("getFinanceDashboard - service抛出异常应被捕获", async () => {
    const error = new Error("数据库连接失败");
    (financeDashboardService.getFinanceDashboard as any).mockRejectedValue(error);
    const req = mockReq();
    const res = mockRes();
    await expect(getFinanceDashboard(req as any, res as any)).rejects.toThrow(error);
  });

  it("getDailyReport - 应传入日期参数", async () => {
    (financeDashboardService.getDailyReport as any).mockResolvedValue([]);
    const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-01-31" } });
    const res = mockRes();
    await getDailyReport(req as any, res as any);
    expect(financeDashboardService.getDailyReport).toHaveBeenCalledWith("t1", "2026-01-01", "2026-01-31");
  });

  it("getDailyReport - 不传日期时为undefined", async () => {
    (financeDashboardService.getDailyReport as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getDailyReport(req as any, res as any);
    expect(financeDashboardService.getDailyReport).toHaveBeenCalledWith("t1", undefined, undefined);
  });

  it("getMonthlyReport - 传入year转换为数字", async () => {
    (financeDashboardService.getMonthlyReport as any).mockResolvedValue([]);
    const req = mockReq({ query: { year: "2026" } });
    const res = mockRes();
    await getMonthlyReport(req as any, res as any);
    expect(financeDashboardService.getMonthlyReport).toHaveBeenCalledWith("t1", 2026);
  });

  it("getMonthlyReport - 不传year时为undefined", async () => {
    (financeDashboardService.getMonthlyReport as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getMonthlyReport(req as any, res as any);
    expect(financeDashboardService.getMonthlyReport).toHaveBeenCalledWith("t1", undefined);
  });

  it("getCashFlow - 默认months为12", async () => {
    (financeDashboardService.getCashFlow as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getCashFlow(req as any, res as any);
    expect(financeDashboardService.getCashFlow).toHaveBeenCalledWith("t1", 12);
  });

  it("getCashFlow - 自定义months", async () => {
    (financeDashboardService.getCashFlow as any).mockResolvedValue([]);
    const req = mockReq({ query: { months: "6" } });
    const res = mockRes();
    await getCashFlow(req as any, res as any);
    expect(financeDashboardService.getCashFlow).toHaveBeenCalledWith("t1", 6);
  });

  it("getProfitTrend - 默认months为12", async () => {
    (financeDashboardService.getProfitTrend as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getProfitTrend(req as any, res as any);
    expect(financeDashboardService.getProfitTrend).toHaveBeenCalledWith("t1", 12);
  });

  it("getTopCustomersAR - 默认limit为10", async () => {
    (financeDashboardService.getTopCustomersAR as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getTopCustomersAR(req as any, res as any);
    expect(financeDashboardService.getTopCustomersAR).toHaveBeenCalledWith("t1", 10);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });

  it("getTopSuppliersAP - 自定义limit", async () => {
    (financeDashboardService.getTopSuppliersAP as any).mockResolvedValue([]);
    const req = mockReq({ query: { limit: "5" } });
    const res = mockRes();
    await getTopSuppliersAP(req as any, res as any);
    expect(financeDashboardService.getTopSuppliersAP).toHaveBeenCalledWith("t1", 5);
  });

  it("getTopCustomersAR - service抛出异常应被捕获", async () => {
    const error = new Error("查询失败");
    (financeDashboardService.getTopCustomersAR as any).mockRejectedValue(error);
    const req = mockReq();
    const res = mockRes();
    await expect(getTopCustomersAR(req as any, res as any)).rejects.toThrow(error);
  });
});