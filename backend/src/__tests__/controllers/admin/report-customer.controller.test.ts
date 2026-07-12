import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/report-customer.service", () => ({
  getRepurchaseAnalysis: vi.fn(),
  getAvgOrderValueDistribution: vi.fn(),
  getRFMAnalysis: vi.fn(),
  getCustomerContributionRanking: vi.fn(),
  getNewCustomerTrend: vi.fn(),
  getLostCustomerAnalysis: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as svc from "../../../services/admin/report-customer.service";
import { ok } from "../../../shared/response";
import {
  getRepurchaseAnalysis,
  getAvgOrderValueDistribution,
  getRFMAnalysis,
  getCustomerContributionRanking,
  getNewCustomerTrend,
  getLostCustomerAnalysis,
} from "../../../controllers/admin/report-customer.controller";

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

describe("report-customer.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getRepurchaseAnalysis - 应返回复购分析", async () => {
    (svc.getRepurchaseAnalysis as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getRepurchaseAnalysis(req as any, res as any);
    expect(svc.getRepurchaseAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1" })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getRepurchaseAnalysis - 应传递日期范围和门店", async () => {
    (svc.getRepurchaseAnalysis as any).mockResolvedValue([]);
    const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-12-31", storeId: "2" } });
    const res = mockRes();
    await getRepurchaseAnalysis(req as any, res as any);
    expect(svc.getRepurchaseAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        storeId: 2,
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getAvgOrderValueDistribution - 应返回客单价分布", async () => {
    (svc.getAvgOrderValueDistribution as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getAvgOrderValueDistribution(req as any, res as any);
    expect(svc.getAvgOrderValueDistribution).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1" })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getAvgOrderValueDistribution - 应传递日期范围和门店", async () => {
    (svc.getAvgOrderValueDistribution as any).mockResolvedValue([]);
    const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-12-31", storeId: "3" } });
    const res = mockRes();
    await getAvgOrderValueDistribution(req as any, res as any);
    expect(svc.getAvgOrderValueDistribution).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        storeId: 3,
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getRFMAnalysis - 应返回RFM分析", async () => {
    (svc.getRFMAnalysis as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getRFMAnalysis(req as any, res as any);
    expect(svc.getRFMAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1" })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getRFMAnalysis - 应传递门店", async () => {
    (svc.getRFMAnalysis as any).mockResolvedValue([]);
    const req = mockReq({ query: { storeId: "1" } });
    const res = mockRes();
    await getRFMAnalysis(req as any, res as any);
    expect(svc.getRFMAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", storeId: 1 })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getCustomerContributionRanking - 应返回客户贡献排名（默认20条）", async () => {
    (svc.getCustomerContributionRanking as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getCustomerContributionRanking(req as any, res as any);
    expect(svc.getCustomerContributionRanking).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", limit: 20 })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getCustomerContributionRanking - 应传递日期范围、门店和limit", async () => {
    (svc.getCustomerContributionRanking as any).mockResolvedValue([]);
    const req = mockReq({
      query: { startDate: "2026-01-01", endDate: "2026-12-31", storeId: "2", limit: "10" },
    });
    const res = mockRes();
    await getCustomerContributionRanking(req as any, res as any);
    expect(svc.getCustomerContributionRanking).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        storeId: 2,
        limit: 10,
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getNewCustomerTrend - 应返回新增客户趋势", async () => {
    (svc.getNewCustomerTrend as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getNewCustomerTrend(req as any, res as any);
    expect(svc.getNewCustomerTrend).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1" })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getNewCustomerTrend - 应传递分组和门店", async () => {
    (svc.getNewCustomerTrend as any).mockResolvedValue([]);
    const req = mockReq({ query: { groupBy: "month", storeId: "1" } });
    const res = mockRes();
    await getNewCustomerTrend(req as any, res as any);
    expect(svc.getNewCustomerTrend).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", groupBy: "month", storeId: 1 })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getLostCustomerAnalysis - 应返回流失客户分析（默认90天）", async () => {
    (svc.getLostCustomerAnalysis as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getLostCustomerAnalysis(req as any, res as any);
    expect(svc.getLostCustomerAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", daysThreshold: 90 })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getLostCustomerAnalysis - 应传递天数阈值和门店", async () => {
    (svc.getLostCustomerAnalysis as any).mockResolvedValue([]);
    const req = mockReq({ query: { daysThreshold: "180", storeId: "2" } });
    const res = mockRes();
    await getLostCustomerAnalysis(req as any, res as any);
    expect(svc.getLostCustomerAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", daysThreshold: 180, storeId: 2 })
    );
    expect(ok).toHaveBeenCalled();
  });
});
