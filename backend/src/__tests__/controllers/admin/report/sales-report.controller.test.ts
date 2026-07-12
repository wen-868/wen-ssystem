import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../../services/admin/report/sales-report.service", () => ({
  getSalesDaily: vi.fn(),
  getSalesTrend: vi.fn(),
  getSalesRanking: vi.fn(),
  getBusinessOverview: vi.fn(),
}));

vi.mock("../../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as salesReportService from "../../../../services/admin/report/sales-report.service";
import { ok } from "../../../../shared/response";
import {
  getSalesDaily,
  getSalesTrend,
  getSalesRanking,
  getBusinessOverview,
} from "../../../../controllers/admin/report/sales-report.controller";

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

describe("report/sales-report.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getSalesDaily - 应返回日销售数据", async () => {
    (salesReportService.getSalesDaily as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getSalesDaily(req as any, res as any);
    expect(salesReportService.getSalesDaily).toHaveBeenCalledWith(
      "t1",
      undefined,
      undefined,
      undefined
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getSalesDaily - 应传递日期范围和门店", async () => {
    (salesReportService.getSalesDaily as any).mockResolvedValue([]);
    const req = mockReq({
      query: { dateStart: "2026-01-01", dateEnd: "2026-12-31", storeId: "2" },
    });
    const res = mockRes();
    await getSalesDaily(req as any, res as any);
    expect(salesReportService.getSalesDaily).toHaveBeenCalledWith(
      "t1",
      "2026-01-01",
      "2026-12-31",
      2
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getSalesTrend - 应返回销售趋势（默认按月）", async () => {
    (salesReportService.getSalesTrend as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getSalesTrend(req as any, res as any);
    expect(salesReportService.getSalesTrend).toHaveBeenCalledWith("t1", "month");
    expect(ok).toHaveBeenCalled();
  });

  it("getSalesTrend - 应传递指定粒度", async () => {
    (salesReportService.getSalesTrend as any).mockResolvedValue([]);
    const req = mockReq({ query: { granularity: "day" } });
    const res = mockRes();
    await getSalesTrend(req as any, res as any);
    expect(salesReportService.getSalesTrend).toHaveBeenCalledWith("t1", "day");
    expect(ok).toHaveBeenCalled();
  });

  it("getSalesRanking - 应返回销售排名（默认按商品）", async () => {
    (salesReportService.getSalesRanking as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getSalesRanking(req as any, res as any);
    expect(salesReportService.getSalesRanking).toHaveBeenCalledWith(
      "t1",
      "product",
      undefined,
      undefined,
      20
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getSalesRanking - 应传递维度、日期范围和limit", async () => {
    (salesReportService.getSalesRanking as any).mockResolvedValue([]);
    const req = mockReq({
      query: {
        dimension: "customer",
        dateStart: "2026-01-01",
        dateEnd: "2026-12-31",
        limit: "10",
      },
    });
    const res = mockRes();
    await getSalesRanking(req as any, res as any);
    expect(salesReportService.getSalesRanking).toHaveBeenCalledWith(
      "t1",
      "customer",
      "2026-01-01",
      "2026-12-31",
      10
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getBusinessOverview - 应返回经营概览", async () => {
    (salesReportService.getBusinessOverview as any).mockResolvedValue({ salesAmount: 10000 });
    const req = mockReq();
    const res = mockRes();
    await getBusinessOverview(req as any, res as any);
    expect(salesReportService.getBusinessOverview).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });
});
