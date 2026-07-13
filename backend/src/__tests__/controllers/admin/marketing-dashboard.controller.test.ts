/**
 * 营销看板 controller 单元测试
 * 被测文件：src/controllers/admin/marketing-dashboard.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../services/admin/marketing-dashboard.service", () => ({
  getMarketingOverview: vi.fn(),
  getActivityStats: vi.fn(),
  getSingleActivityStats: vi.fn(),
  getCouponStats: vi.fn(),
  getMarketingTrend: vi.fn(),
  getActivityRanking: vi.fn(),
  getActivityComparison: vi.fn(),
  getActivityEffectAnalysis: vi.fn(),
  getActivityConversionTrend: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as svc from "../../../services/admin/marketing-dashboard.service";
import { ok } from "../../../shared/response";
import {
  getMarketingOverview,
  getActivityStats,
  getSingleActivityStats,
  getCouponStats,
  getMarketingTrend,
  getActivityRanking,
  getActivityComparison,
  getActivityEffectAnalysis,
  getActivityConversionTrend,
} from "../../../controllers/admin/marketing-dashboard.controller";

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

describe("admin/marketing-dashboard.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getMarketingOverview", () => {
    it("获取营销概览", async () => {
      (svc.getMarketingOverview as any).mockResolvedValue({ totalCoupons: 100 });
      const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-01-31" } });
      const res = mockRes();
      await getMarketingOverview(req as any, res as any);
      expect(svc.getMarketingOverview).toHaveBeenCalledWith(expect.objectContaining({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        tenantId: "t1",
      }));
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("getActivityStats", () => {
    it("获取活动统计", async () => {
      (svc.getActivityStats as any).mockResolvedValue({ total: 10 });
      const req = mockReq({ query: { activityType: "coupon" } });
      const res = mockRes();
      await getActivityStats(req as any, res as any);
      expect(svc.getActivityStats).toHaveBeenCalledWith(expect.objectContaining({
        activityType: "coupon",
      }));
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("getSingleActivityStats", () => {
    it("指定 activityType 时传递参数", async () => {
      (svc.getSingleActivityStats as any).mockResolvedValue({ name: "活动1" });
      const req = mockReq({ params: { activityId: "1" }, query: { activityType: "full_reduction" } });
      const res = mockRes();
      await getSingleActivityStats(req as any, res as any);
      expect(svc.getSingleActivityStats).toHaveBeenCalledWith(1, "full_reduction", "t1");
    });

    it("不指定 activityType 时使用默认值 coupon", async () => {
      (svc.getSingleActivityStats as any).mockResolvedValue({ name: "活动1" });
      const req = mockReq({ params: { activityId: "1" }, query: {} });
      const res = mockRes();
      await getSingleActivityStats(req as any, res as any);
      expect(svc.getSingleActivityStats).toHaveBeenCalledWith(1, "coupon", "t1");
    });
  });

  describe("getCouponStats", () => {
    it("获取优惠券统计", async () => {
      (svc.getCouponStats as any).mockResolvedValue({ issued: 100 });
      const req = mockReq({});
      const res = mockRes();
      await getCouponStats(req as any, res as any);
      expect(svc.getCouponStats).toHaveBeenCalledWith("t1");
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("getMarketingTrend", () => {
    it("获取营销趋势", async () => {
      (svc.getMarketingTrend as any).mockResolvedValue({ trend: [] });
      const req = mockReq({ query: { period: "day" } });
      const res = mockRes();
      await getMarketingTrend(req as any, res as any);
      expect(svc.getMarketingTrend).toHaveBeenCalledWith(expect.objectContaining({ period: "day" }));
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("getActivityRanking", () => {
    it("获取活动排行", async () => {
      (svc.getActivityRanking as any).mockResolvedValue({ ranking: [] });
      const req = mockReq({ query: { rankBy: "usedCount" } });
      const res = mockRes();
      await getActivityRanking(req as any, res as any);
      expect(svc.getActivityRanking).toHaveBeenCalledWith(expect.objectContaining({ rankBy: "usedCount" }));
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("getActivityComparison", () => {
    it("多个 activityId 数组", async () => {
      (svc.getActivityComparison as any).mockResolvedValue({ comparison: [] });
      const req = mockReq({ query: { activityIds: ["1", "2", "3"] } });
      const res = mockRes();
      await getActivityComparison(req as any, res as any);
      expect(svc.getActivityComparison).toHaveBeenCalledWith(expect.objectContaining({
        activityIds: [1, 2, 3],
      }));
      expect(ok).toHaveBeenCalled();
    });

    it("单个 activityId 字符串", async () => {
      (svc.getActivityComparison as any).mockResolvedValue({ comparison: [] });
      const req = mockReq({ query: { activityIds: "5" } });
      const res = mockRes();
      await getActivityComparison(req as any, res as any);
      expect(svc.getActivityComparison).toHaveBeenCalledWith(expect.objectContaining({
        activityIds: [5],
      }));
    });

    it("无 activityIds 时空数组", async () => {
      (svc.getActivityComparison as any).mockResolvedValue({ comparison: [] });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await getActivityComparison(req as any, res as any);
      expect(svc.getActivityComparison).toHaveBeenCalledWith(expect.objectContaining({
        activityIds: [],
      }));
    });
  });

  describe("getActivityEffectAnalysis", () => {
    it("指定 activityType", async () => {
      (svc.getActivityEffectAnalysis as any).mockResolvedValue({ effect: "good" });
      const req = mockReq({ params: { activityId: "1" }, query: { activityType: "full_reduction" } });
      const res = mockRes();
      await getActivityEffectAnalysis(req as any, res as any);
      expect(svc.getActivityEffectAnalysis).toHaveBeenCalledWith(expect.objectContaining({
        activityId: 1,
        activityType: "full_reduction",
      }));
      expect(ok).toHaveBeenCalled();
    });

    it("不指定 activityType 时默认 coupon", async () => {
      (svc.getActivityEffectAnalysis as any).mockResolvedValue({ effect: "good" });
      const req = mockReq({ params: { activityId: "1" }, query: {} });
      const res = mockRes();
      await getActivityEffectAnalysis(req as any, res as any);
      expect(svc.getActivityEffectAnalysis).toHaveBeenCalledWith(expect.objectContaining({
        activityType: "coupon",
      }));
    });
  });

  describe("getActivityConversionTrend", () => {
    it("获取活动转化趋势", async () => {
      (svc.getActivityConversionTrend as any).mockResolvedValue({ trend: [] });
      const req = mockReq({ params: { activityId: "1" }, query: { period: "day" } });
      const res = mockRes();
      await getActivityConversionTrend(req as any, res as any);
      expect(svc.getActivityConversionTrend).toHaveBeenCalledWith(expect.objectContaining({
        activityId: 1,
        period: "day",
      }));
      expect(ok).toHaveBeenCalled();
    });
  });
});
