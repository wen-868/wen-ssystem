/**
 * 管理端财务看板 controller 单元测试
 * 被测文件：src/controllers/admin/finance-dashboard.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  getFinanceDashboard: vi.fn(),
  getDailyReport: vi.fn(),
  getMonthlyReport: vi.fn(),
  getCashFlow: vi.fn(),
  getProfitTrend: vi.fn(),
  getTopCustomersAR: vi.fn(),
  getTopSuppliersAP: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/finance-dashboard.service.js", () => ({
  getFinanceDashboard: mocks.getFinanceDashboard,
  getDailyReport: mocks.getDailyReport,
  getMonthlyReport: mocks.getMonthlyReport,
  getCashFlow: mocks.getCashFlow,
  getProfitTrend: mocks.getProfitTrend,
  getTopCustomersAR: mocks.getTopCustomersAR,
  getTopSuppliersAP: mocks.getTopSuppliersAP,
}));

import {
  getFinanceDashboard,
  getDailyReport,
  getMonthlyReport,
  getCashFlow,
  getProfitTrend,
  getTopCustomersAR,
  getTopSuppliersAP,
} from "../../../controllers/admin/finance-dashboard.controller.js";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin finance-dashboard.controller", () => {
  it("getFinanceDashboard 调用 service 并返回结果", async () => {
    mocks.getFinanceDashboard.mockResolvedValue({ revenue: 10000 });
    const req = mockReq();
    const res = mockRes();
    await getFinanceDashboard(req, res);
    expect(mocks.getFinanceDashboard).toHaveBeenCalledWith("t1");
    expect(mocks.ok).toHaveBeenCalledWith({ revenue: 10000 });
  });

  it("getDailyReport 传入日期参数", async () => {
    mocks.getDailyReport.mockResolvedValue([]);
    const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-01-31" } });
    const res = mockRes();
    await getDailyReport(req, res);
    expect(mocks.getDailyReport).toHaveBeenCalledWith("t1", "2026-01-01", "2026-01-31");
  });

  it("getDailyReport 不传日期时为 undefined", async () => {
    mocks.getDailyReport.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getDailyReport(req, res);
    expect(mocks.getDailyReport).toHaveBeenCalledWith("t1", undefined, undefined);
  });

  it("getMonthlyReport 传入 year 转换为数字", async () => {
    mocks.getMonthlyReport.mockResolvedValue([]);
    const req = mockReq({ query: { year: "2026" } });
    const res = mockRes();
    await getMonthlyReport(req, res);
    expect(mocks.getMonthlyReport).toHaveBeenCalledWith("t1", 2026);
  });

  it("getMonthlyReport 不传 year 时为 undefined", async () => {
    mocks.getMonthlyReport.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getMonthlyReport(req, res);
    expect(mocks.getMonthlyReport).toHaveBeenCalledWith("t1", undefined);
  });

  it("getCashFlow 默认 months 为 12", async () => {
    mocks.getCashFlow.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getCashFlow(req, res);
    expect(mocks.getCashFlow).toHaveBeenCalledWith("t1", 12);
  });

  it("getCashFlow 自定义 months", async () => {
    mocks.getCashFlow.mockResolvedValue([]);
    const req = mockReq({ query: { months: "6" } });
    const res = mockRes();
    await getCashFlow(req, res);
    expect(mocks.getCashFlow).toHaveBeenCalledWith("t1", 6);
  });

  it("getProfitTrend 默认 months 为 12", async () => {
    mocks.getProfitTrend.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getProfitTrend(req, res);
    expect(mocks.getProfitTrend).toHaveBeenCalledWith("t1", 12);
  });

  it("getTopCustomersAR 默认 limit 为 10", async () => {
    mocks.getTopCustomersAR.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getTopCustomersAR(req, res);
    expect(mocks.getTopCustomersAR).toHaveBeenCalledWith("t1", 10);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });

  it("getTopSuppliersAP 自定义 limit", async () => {
    mocks.getTopSuppliersAP.mockResolvedValue([]);
    const req = mockReq({ query: { limit: "5" } });
    const res = mockRes();
    await getTopSuppliersAP(req, res);
    expect(mocks.getTopSuppliersAP).toHaveBeenCalledWith("t1", 5);
  });
});
