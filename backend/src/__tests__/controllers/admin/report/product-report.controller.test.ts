import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../../services/admin/report/product-report.service", () => ({
  getInventorySummary: vi.fn(),
  getInventoryTurnover: vi.fn(),
  getInventoryAge: vi.fn(),
  getPurchaseSummary: vi.fn(),
  getSupplierRanking: vi.fn(),
}));

vi.mock("../../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as productReportService from "../../../../services/admin/report/product-report.service";
import { ok } from "../../../../shared/response";
import {
  getInventorySummary,
  getInventoryTurnover,
  getInventoryAge,
  getPurchaseSummary,
  getSupplierRanking,
} from "../../../../controllers/admin/report/product-report.controller";

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

describe("report/product-report.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getInventorySummary - 应返回库存汇总（默认按商品）", async () => {
    (productReportService.getInventorySummary as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getInventorySummary(req as any, res as any, vi.fn());
    expect(productReportService.getInventorySummary).toHaveBeenCalledWith(
      "t1",
      "product",
      undefined
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getInventorySummary - 应传递分组和门店", async () => {
    (productReportService.getInventorySummary as any).mockResolvedValue([]);
    const req = mockReq({ query: { groupBy: "store", storeId: "2" } });
    const res = mockRes();
    await getInventorySummary(req as any, res as any, vi.fn());
    expect(productReportService.getInventorySummary).toHaveBeenCalledWith(
      "t1",
      "store",
      2
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getInventoryTurnover - 应返回库存周转（默认3个月）", async () => {
    (productReportService.getInventoryTurnover as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getInventoryTurnover(req as any, res as any, vi.fn());
    expect(productReportService.getInventoryTurnover).toHaveBeenCalledWith("t1", 3);
    expect(ok).toHaveBeenCalled();
  });

  it("getInventoryTurnover - 应传递指定月数", async () => {
    (productReportService.getInventoryTurnover as any).mockResolvedValue([]);
    const req = mockReq({ query: { months: "6" } });
    const res = mockRes();
    await getInventoryTurnover(req as any, res as any, vi.fn());
    expect(productReportService.getInventoryTurnover).toHaveBeenCalledWith("t1", 6);
    expect(ok).toHaveBeenCalled();
  });

  it("getInventoryAge - 应返回库龄", async () => {
    (productReportService.getInventoryAge as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getInventoryAge(req as any, res as any, vi.fn());
    expect(productReportService.getInventoryAge).toHaveBeenCalledWith("t1", undefined);
    expect(ok).toHaveBeenCalled();
  });

  it("getInventoryAge - 应传递门店", async () => {
    (productReportService.getInventoryAge as any).mockResolvedValue([]);
    const req = mockReq({ query: { storeId: "3" } });
    const res = mockRes();
    await getInventoryAge(req as any, res as any, vi.fn());
    expect(productReportService.getInventoryAge).toHaveBeenCalledWith("t1", 3);
    expect(ok).toHaveBeenCalled();
  });

  it("getPurchaseSummary - 应返回采购汇总", async () => {
    (productReportService.getPurchaseSummary as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getPurchaseSummary(req as any, res as any, vi.fn());
    expect(productReportService.getPurchaseSummary).toHaveBeenCalledWith(
      "t1",
      undefined,
      undefined
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getPurchaseSummary - 应传递日期范围", async () => {
    (productReportService.getPurchaseSummary as any).mockResolvedValue([]);
    const req = mockReq({ query: { dateStart: "2026-01-01", dateEnd: "2026-12-31" } });
    const res = mockRes();
    await getPurchaseSummary(req as any, res as any, vi.fn());
    expect(productReportService.getPurchaseSummary).toHaveBeenCalledWith(
      "t1",
      "2026-01-01",
      "2026-12-31"
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getSupplierRanking - 应返回供应商排名（默认20条）", async () => {
    (productReportService.getSupplierRanking as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getSupplierRanking(req as any, res as any, vi.fn());
    expect(productReportService.getSupplierRanking).toHaveBeenCalledWith(
      "t1",
      undefined,
      undefined,
      20
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getSupplierRanking - 应传递日期范围和limit", async () => {
    (productReportService.getSupplierRanking as any).mockResolvedValue([]);
    const req = mockReq({
      query: { dateStart: "2026-01-01", dateEnd: "2026-12-31", limit: "10" },
    });
    const res = mockRes();
    await getSupplierRanking(req as any, res as any, vi.fn());
    expect(productReportService.getSupplierRanking).toHaveBeenCalledWith(
      "t1",
      "2026-01-01",
      "2026-12-31",
      10
    );
    expect(ok).toHaveBeenCalled();
  });
});
