import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/instant-retail/retail-analytics.service.js", () => ({
  getAnalyticsSummary: vi.fn(),
  getSalesTrend: vi.fn(),
  getPlatformComparison: vi.fn(),
  getTopProducts: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as svc from "../../../services/instant-retail/retail-analytics.service.js";
import { ok } from "../../../shared/response.js";
import { getAnalyticsSummary, getSalesTrend, getPlatformComparison, getTopProducts } from "../../../controllers/instant-retail/analytics.controller.js";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, storeId: 1 },
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

describe("instant-retail/analytics.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getAnalyticsSummary - 应返回分析汇总", async () => {
    (svc.getAnalyticsSummary as any).mockResolvedValue({ totalOrders: 100 });
    const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-01-31", storeId: "1" } });
    const res = mockRes();
    await getAnalyticsSummary(req as any, res as any);
    expect(svc.getAnalyticsSummary).toHaveBeenCalledWith({
      tenantId: "t1",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      storeId: 1,
    });
    expect(ok).toHaveBeenCalled();
  });

  it("getAnalyticsSummary - 无 storeId 时为 undefined", async () => {
    (svc.getAnalyticsSummary as any).mockResolvedValue({});
    const req = mockReq({ query: {} });
    const res = mockRes();
    await getAnalyticsSummary(req as any, res as any);
    expect(svc.getAnalyticsSummary).toHaveBeenCalledWith(expect.objectContaining({
      storeId: undefined,
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("getSalesTrend - 应返回销售趋势", async () => {
    (svc.getSalesTrend as any).mockResolvedValue([]);
    const req = mockReq({ query: { period: "day", startDate: "2026-01-01", endDate: "2026-01-31", storeId: "1" } });
    const res = mockRes();
    await getSalesTrend(req as any, res as any);
    expect(svc.getSalesTrend).toHaveBeenCalledWith({
      tenantId: "t1",
      period: "day",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      storeId: 1,
    });
    expect(ok).toHaveBeenCalled();
  });

  it("getPlatformComparison - 应返回平台对比", async () => {
    (svc.getPlatformComparison as any).mockResolvedValue([]);
    const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-01-31" } });
    const res = mockRes();
    await getPlatformComparison(req as any, res as any);
    expect(svc.getPlatformComparison).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "t1",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("getTopProducts - 应返回热销商品", async () => {
    (svc.getTopProducts as any).mockResolvedValue([]);
    const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-01-31", limit: "20" } });
    const res = mockRes();
    await getTopProducts(req as any, res as any);
    expect(svc.getTopProducts).toHaveBeenCalledWith(expect.objectContaining({
      limit: 20,
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("getTopProducts - limit 默认值为 10", async () => {
    (svc.getTopProducts as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await getTopProducts(req as any, res as any);
    expect(svc.getTopProducts).toHaveBeenCalledWith(expect.objectContaining({
      limit: 10,
    }));
    expect(ok).toHaveBeenCalled();
  });
});
