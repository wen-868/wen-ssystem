import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/report-collection.service", () => ({
  getCollectionFunnel: vi.fn(),
  getChannelConversion: vi.fn(),
  getCollectionTimeout: vi.fn(),
  getCollectionDailyTrend: vi.fn(),
  getCollectionSummary: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as svc from "../../../services/admin/report-collection.service";
import { ok } from "../../../shared/response";
import {
  getCollectionFunnel,
  getChannelConversion,
  getCollectionTimeout,
  getCollectionDailyTrend,
  getCollectionSummary,
} from "../../../controllers/admin/report-collection.controller";

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

describe("report-collection.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getCollectionFunnel - 应返回收款漏斗", async () => {
    (svc.getCollectionFunnel as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getCollectionFunnel(req as any, res as any, vi.fn());
    expect(svc.getCollectionFunnel).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1" })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getCollectionFunnel - 应传递日期范围和门店", async () => {
    (svc.getCollectionFunnel as any).mockResolvedValue([]);
    const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-12-31", storeId: "2" } });
    const res = mockRes();
    await getCollectionFunnel(req as any, res as any, vi.fn());
    expect(svc.getCollectionFunnel).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        storeId: 2,
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getChannelConversion - 应返回渠道转化", async () => {
    (svc.getChannelConversion as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getChannelConversion(req as any, res as any, vi.fn());
    expect(svc.getChannelConversion).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1" })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getChannelConversion - 应传递日期范围和门店", async () => {
    (svc.getChannelConversion as any).mockResolvedValue([]);
    const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-12-31", storeId: "3" } });
    const res = mockRes();
    await getChannelConversion(req as any, res as any, vi.fn());
    expect(svc.getChannelConversion).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        storeId: 3,
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getCollectionTimeout - 应返回收款超时", async () => {
    (svc.getCollectionTimeout as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getCollectionTimeout(req as any, res as any, vi.fn());
    expect(svc.getCollectionTimeout).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1" })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getCollectionTimeout - 应传递日期范围和门店", async () => {
    (svc.getCollectionTimeout as any).mockResolvedValue([]);
    const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-12-31", storeId: "1" } });
    const res = mockRes();
    await getCollectionTimeout(req as any, res as any, vi.fn());
    expect(svc.getCollectionTimeout).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        storeId: 1,
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getCollectionDailyTrend - 应返回收款日趋势", async () => {
    (svc.getCollectionDailyTrend as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getCollectionDailyTrend(req as any, res as any, vi.fn());
    expect(svc.getCollectionDailyTrend).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1" })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getCollectionDailyTrend - 应传递日期范围和门店", async () => {
    (svc.getCollectionDailyTrend as any).mockResolvedValue([]);
    const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-12-31", storeId: "2" } });
    const res = mockRes();
    await getCollectionDailyTrend(req as any, res as any, vi.fn());
    expect(svc.getCollectionDailyTrend).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        storeId: 2,
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getCollectionSummary - 应返回收款汇总", async () => {
    (svc.getCollectionSummary as any).mockResolvedValue({ totalAmount: 10000 });
    const req = mockReq();
    const res = mockRes();
    await getCollectionSummary(req as any, res as any, vi.fn());
    expect(svc.getCollectionSummary).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1" })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getCollectionSummary - 应传递门店", async () => {
    (svc.getCollectionSummary as any).mockResolvedValue({ totalAmount: 10000 });
    const req = mockReq({ query: { storeId: "3" } });
    const res = mockRes();
    await getCollectionSummary(req as any, res as any, vi.fn());
    expect(svc.getCollectionSummary).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", storeId: 3 })
    );
    expect(ok).toHaveBeenCalled();
  });
});
