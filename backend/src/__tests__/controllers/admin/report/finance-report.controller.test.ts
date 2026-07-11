import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../../services/admin/report/finance-report.service.js", () => ({
  getReceivablePayable: vi.fn(),
  getPaymentAnalysis: vi.fn(),
  getProfit: vi.fn(),
}));

vi.mock("../../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as financeReportService from "../../../../services/admin/report/finance-report.service.js";
import { ok } from "../../../../shared/response.js";
import {
  getReceivablePayable,
  getPaymentAnalysis,
  getProfit,
} from "../../../../controllers/admin/report/finance-report.controller.js";

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

describe("report/finance-report.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getReceivablePayable - 应返回应收应付", async () => {
    (financeReportService.getReceivablePayable as any).mockResolvedValue({ receivable: 1000, payable: 500 });
    const req = mockReq();
    const res = mockRes();
    await getReceivablePayable(req as any, res as any);
    expect(financeReportService.getReceivablePayable).toHaveBeenCalledWith(
      "t1",
      undefined,
      undefined
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getReceivablePayable - 应传递日期范围", async () => {
    (financeReportService.getReceivablePayable as any).mockResolvedValue({ receivable: 1000, payable: 500 });
    const req = mockReq({ query: { dateStart: "2026-01-01", dateEnd: "2026-12-31" } });
    const res = mockRes();
    await getReceivablePayable(req as any, res as any);
    expect(financeReportService.getReceivablePayable).toHaveBeenCalledWith(
      "t1",
      "2026-01-01",
      "2026-12-31"
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getPaymentAnalysis - 应返回支付分析（默认按日期）", async () => {
    (financeReportService.getPaymentAnalysis as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getPaymentAnalysis(req as any, res as any);
    expect(financeReportService.getPaymentAnalysis).toHaveBeenCalledWith(
      "t1",
      undefined,
      undefined,
      "date"
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getPaymentAnalysis - 应传递日期范围和分组", async () => {
    (financeReportService.getPaymentAnalysis as any).mockResolvedValue([]);
    const req = mockReq({
      query: { dateStart: "2026-01-01", dateEnd: "2026-12-31", groupBy: "customer" },
    });
    const res = mockRes();
    await getPaymentAnalysis(req as any, res as any);
    expect(financeReportService.getPaymentAnalysis).toHaveBeenCalledWith(
      "t1",
      "2026-01-01",
      "2026-12-31",
      "customer"
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getProfit - 应返回利润数据", async () => {
    (financeReportService.getProfit as any).mockResolvedValue({ profit: 5000 });
    const req = mockReq();
    const res = mockRes();
    await getProfit(req as any, res as any);
    expect(financeReportService.getProfit).toHaveBeenCalledWith(
      "t1",
      undefined,
      undefined
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getProfit - 应传递日期范围", async () => {
    (financeReportService.getProfit as any).mockResolvedValue({ profit: 5000 });
    const req = mockReq({ query: { dateStart: "2026-01-01", dateEnd: "2026-12-31" } });
    const res = mockRes();
    await getProfit(req as any, res as any);
    expect(financeReportService.getProfit).toHaveBeenCalledWith(
      "t1",
      "2026-01-01",
      "2026-12-31"
    );
    expect(ok).toHaveBeenCalled();
  });
});
