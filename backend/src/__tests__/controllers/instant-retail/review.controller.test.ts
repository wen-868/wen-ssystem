import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/instant-retail/review.service", () => ({
  listReviews: vi.fn(),
  getReviewDetail: vi.fn(),
  replyReview: vi.fn(),
  syncReviewsFromPlatform: vi.fn(),
  getReviewStats: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as svc from "../../../services/instant-retail/review.service";
import { ok, fail } from "../../../shared/response";
import { listReviews, getReviewDetail, replyReview, syncReviews, getReviewStats } from "../../../controllers/instant-retail/review.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1 },
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

describe("instant-retail/review.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listReviews - 应返回评价列表", async () => {
    (svc.listReviews as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: "1", pageSize: "20", platform: "MEITUAN", rating: "5", status: "PENDING", storeId: "1" } });
    const res = mockRes();
    await listReviews(req as any, res as any);
    expect(svc.listReviews).toHaveBeenCalledWith({
      tenantId: "t1",
      page: 1,
      pageSize: 20,
      platform: "MEITUAN",
      rating: 5,
      status: "PENDING",
      storeId: 1,
    });
    expect(ok).toHaveBeenCalled();
  });

  it("listReviews - 无参数时使用默认值", async () => {
    (svc.listReviews as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listReviews(req as any, res as any);
    expect(svc.listReviews).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      pageSize: 20,
      rating: undefined,
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("getReviewDetail - 评价不存在应返回404", async () => {
    (svc.getReviewDetail as any).mockResolvedValue(null);
    const req = mockReq({ params: { id: "999" } });
    const res = mockRes();
    await getReviewDetail(req as any, res as any);
    expect(svc.getReviewDetail).toHaveBeenCalledWith(999, "t1");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("评价不存在", "404");
  });

  it("getReviewDetail - 应返回评价详情", async () => {
    (svc.getReviewDetail as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getReviewDetail(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("replyReview - 应回复评价", async () => {
    (svc.replyReview as any).mockResolvedValue({ id: 1, reply: "感谢评价" });
    const req = mockReq({ params: { id: "1" }, body: { reply: "感谢评价" } });
    const res = mockRes();
    await replyReview(req as any, res as any);
    expect(svc.replyReview).toHaveBeenCalledWith(1, "感谢评价", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("syncReviews - 应同步评价", async () => {
    (svc.syncReviewsFromPlatform as any).mockResolvedValue(10);
    const req = mockReq({ body: { platform: "MEITUAN", storeId: 1 } });
    const res = mockRes();
    await syncReviews(req as any, res as any);
    expect(svc.syncReviewsFromPlatform).toHaveBeenCalledWith("MEITUAN", 1, "t1");
    expect(ok).toHaveBeenCalledWith({ platform: "MEITUAN", synced: 10 });
  });

  it("getReviewStats - 应返回评价统计", async () => {
    (svc.getReviewStats as any).mockResolvedValue({ total: 100, averageRating: 4.5 });
    const req = mockReq({ query: { platform: "MEITUAN", storeId: "1" } });
    const res = mockRes();
    await getReviewStats(req as any, res as any);
    expect(svc.getReviewStats).toHaveBeenCalledWith({
      tenantId: "t1",
      platform: "MEITUAN",
      storeId: 1,
    });
    expect(ok).toHaveBeenCalled();
  });

  it("getReviewStats - 无 storeId 时为 undefined", async () => {
    (svc.getReviewStats as any).mockResolvedValue({});
    const req = mockReq({ query: {} });
    const res = mockRes();
    await getReviewStats(req as any, res as any);
    expect(svc.getReviewStats).toHaveBeenCalledWith(expect.objectContaining({
      storeId: undefined,
    }));
    expect(ok).toHaveBeenCalled();
  });
});
