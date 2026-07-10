/**
 * 管理端营销看板 controller 单元测试
 * 被测文件：src/controllers/admin/marketing-dashboard.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  getMarketingOverview: vi.fn(),
  getActivityStats: vi.fn(),
  getSingleActivityStats: vi.fn(),
  getCouponStats: vi.fn(),
  getMarketingTrend: vi.fn(),
  getActivityRanking: vi.fn(),
  getActivityComparison: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
}));

vi.mock("../../../services/admin/marketing-dashboard.service.js", () => ({
  getMarketingOverview: mocks.getMarketingOverview,
  getActivityStats: mocks.getActivityStats,
  getSingleActivityStats: mocks.getSingleActivityStats,
  getCouponStats: mocks.getCouponStats,
  getMarketingTrend: mocks.getMarketingTrend,
  getActivityRanking: mocks.getActivityRanking,
  getActivityComparison: mocks.getActivityComparison,
}));

import {
  getMarketingOverview,
  getActivityStats,
  getSingleActivityStats,
  getCouponStats,
  getMarketingTrend,
  getActivityRanking,
  getActivityComparison,
} from "../../../controllers/admin/marketing-dashboard.controller.js";

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

describe("admin marketing-dashboard.controller", () => {
  it("getMarketingOverview 传递日期范围参数", async () => {
    mocks.getMarketingOverview.mockResolvedValue({ totalActivities: 10 });
    const req = mockReq({ query: { startDate: "2026-07-01", endDate: "2026-07-31" } });
    const res = mockRes();
    await getMarketingOverview(req, res);
    expect(mocks.getMarketingOverview).toHaveBeenCalledWith({ tenantId: "t1", startDate: "2026-07-01", endDate: "2026-07-31" });
    expect(res.json).toHaveBeenCalled();
  });

  it("getMarketingOverview 无日期参数时传 undefined", async () => {
    mocks.getMarketingOverview.mockResolvedValue({});
    const req = mockReq();
    const res = mockRes();
    await getMarketingOverview(req, res);
    expect(mocks.getMarketingOverview).toHaveBeenCalledWith({ tenantId: "t1", startDate: undefined, endDate: undefined });
  });

  it("getActivityStats 传递 activityType 参数", async () => {
    mocks.getActivityStats.mockResolvedValue([{ type: "coupon", count: 5 }]);
    const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-12-31", activityType: "coupon" } });
    const res = mockRes();
    await getActivityStats(req, res);
    expect(mocks.getActivityStats).toHaveBeenCalledWith({ tenantId: "t1", startDate: "2026-01-01", endDate: "2026-12-31", activityType: "coupon" });
  });

  it("getSingleActivityStats 根据 params.activityId 和 activityType 调用 service", async () => {
    mocks.getSingleActivityStats.mockResolvedValue({ id: 7, stats: {} });
    const req = mockReq({ params: { activityId: "7" }, query: { activityType: "flash_sale" } });
    const res = mockRes();
    await getSingleActivityStats(req, res);
    expect(mocks.getSingleActivityStats).toHaveBeenCalledWith(7, "flash_sale", "t1");
  });

  it("getSingleActivityStats activityType 缺失时默认 coupon", async () => {
    mocks.getSingleActivityStats.mockResolvedValue({});
    const req = mockReq({ params: { activityId: "3" } });
    const res = mockRes();
    await getSingleActivityStats(req, res);
    expect(mocks.getSingleActivityStats).toHaveBeenCalledWith(3, "coupon", "t1");
  });

  it("getCouponStats 仅传 tenantId", async () => {
    mocks.getCouponStats.mockResolvedValue({ total: 100 });
    const req = mockReq();
    const res = mockRes();
    await getCouponStats(req, res);
    expect(mocks.getCouponStats).toHaveBeenCalledWith("t1");
  });

  it("getMarketingTrend 传递 period 和日期范围", async () => {
    mocks.getMarketingTrend.mockResolvedValue([{ period: "2026-07", count: 3 }]);
    const req = mockReq({ query: { period: "month", startDate: "2026-01-01", endDate: "2026-12-31" } });
    const res = mockRes();
    await getMarketingTrend(req, res);
    expect(mocks.getMarketingTrend).toHaveBeenCalledWith({ tenantId: "t1", period: "month", startDate: "2026-01-01", endDate: "2026-12-31" });
  });

  it("getActivityComparison activityIds 为字符串时转为单元素数组", async () => {
    mocks.getActivityComparison.mockResolvedValue([]);
    const req = mockReq({ query: { activityIds: "5", startDate: "2026-01-01", endDate: "2026-12-31" } });
    const res = mockRes();
    await getActivityComparison(req, res);
    expect(mocks.getActivityComparison).toHaveBeenCalledWith({ tenantId: "t1", activityIds: [5], startDate: "2026-01-01", endDate: "2026-12-31" });
  });

  it("getActivityComparison activityIds 缺失时传空数组", async () => {
    mocks.getActivityComparison.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getActivityComparison(req, res);
    expect(mocks.getActivityComparison).toHaveBeenCalledWith({ tenantId: "t1", activityIds: [], startDate: undefined, endDate: undefined });
  });
});
