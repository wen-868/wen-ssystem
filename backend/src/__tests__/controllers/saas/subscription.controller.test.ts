import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/saas/subscription.service.js", () => ({
  listSubscriptions: vi.fn(),
  getSubscriptionDetail: vi.fn(),
  createSubscription: vi.fn(),
  renewSubscription: vi.fn(),
  upgradeSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  getSubscriptionStatistics: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as subscriptionService from "../../../services/saas/subscription.service.js";
import { ok, fail } from "../../../shared/response.js";
import { listSubscriptions, getSubscriptionDetail, createSubscription, renewSubscription, upgradeSubscription, cancelSubscription, getSubscriptionStatistics } from "../../../controllers/saas/subscription.controller.js";

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

describe("saas/subscription.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listSubscriptions - 应返回订阅列表", async () => {
    (subscriptionService.listSubscriptions as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { tenantId: "1", status: "ACTIVE", planId: "1", keyword: "测试", page: "1", pageSize: "20" } });
    const res = mockRes();
    await listSubscriptions(req as any, res as any);
    expect(subscriptionService.listSubscriptions).toHaveBeenCalledWith({
      tenantId: 1,
      status: "ACTIVE",
      planId: 1,
      keyword: "测试",
      page: 1,
      pageSize: 20,
    });
    expect(ok).toHaveBeenCalled();
  });

  it("listSubscriptions - 无参数时使用默认值", async () => {
    (subscriptionService.listSubscriptions as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listSubscriptions(req as any, res as any);
    expect(subscriptionService.listSubscriptions).toHaveBeenCalledWith({
      tenantId: undefined,
      status: undefined,
      planId: undefined,
      keyword: undefined,
      page: 1,
      pageSize: 20,
    });
    expect(ok).toHaveBeenCalled();
  });

  it("getSubscriptionDetail - 订阅不存在应返回404", async () => {
    (subscriptionService.getSubscriptionDetail as any).mockResolvedValue(null);
    const req = mockReq({ params: { id: "999" } });
    const res = mockRes();
    await getSubscriptionDetail(req as any, res as any);
    expect(subscriptionService.getSubscriptionDetail).toHaveBeenCalledWith(999);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("订阅不存在", "404");
  });

  it("getSubscriptionDetail - 应返回订阅详情", async () => {
    (subscriptionService.getSubscriptionDetail as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getSubscriptionDetail(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("createSubscription - 应创建订阅", async () => {
    (subscriptionService.createSubscription as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { tenantId: 1, planId: 1, planName: "基础版", planType: "MONTHLY", durationDays: 30, price: 99 } });
    const res = mockRes();
    await createSubscription(req as any, res as any);
    expect(subscriptionService.createSubscription).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 1,
      planId: 1,
      planName: "基础版",
      planType: "MONTHLY",
      durationDays: 30,
      price: 99,
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("renewSubscription - 订阅不存在应返回404", async () => {
    (subscriptionService.renewSubscription as any).mockResolvedValue(null);
    const req = mockReq({ params: { id: "999" }, body: { durationDays: 30 } });
    const res = mockRes();
    await renewSubscription(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("订阅不存在", "404");
  });

  it("renewSubscription - 应续费订阅", async () => {
    (subscriptionService.renewSubscription as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: { durationDays: 30, price: 99, remark: "续费" } });
    const res = mockRes();
    await renewSubscription(req as any, res as any);
    expect(subscriptionService.renewSubscription).toHaveBeenCalledWith(1, { durationDays: 30, price: 99, remark: "续费" });
    expect(ok).toHaveBeenCalled();
  });

  it("upgradeSubscription - 订阅或套餐不存在应返回404", async () => {
    (subscriptionService.upgradeSubscription as any).mockResolvedValue(null);
    const req = mockReq({ params: { id: "999" }, body: { newPlanId: 2 } });
    const res = mockRes();
    await upgradeSubscription(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("订阅不存在或套餐不存在", "404");
  });

  it("upgradeSubscription - 应升级订阅", async () => {
    (subscriptionService.upgradeSubscription as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: { newPlanId: 2, remark: "升级" } });
    const res = mockRes();
    await upgradeSubscription(req as any, res as any);
    expect(subscriptionService.upgradeSubscription).toHaveBeenCalledWith(1, { newPlanId: 2, remark: "升级" });
    expect(ok).toHaveBeenCalled();
  });

  it("cancelSubscription - 订阅不存在应返回404", async () => {
    (subscriptionService.cancelSubscription as any).mockResolvedValue(null);
    const req = mockReq({ params: { id: "999" }, body: { cancelReason: "不需要了" } });
    const res = mockRes();
    await cancelSubscription(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("订阅不存在", "404");
  });

  it("cancelSubscription - 应取消订阅", async () => {
    (subscriptionService.cancelSubscription as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: { cancelReason: "不需要了" } });
    const res = mockRes();
    await cancelSubscription(req as any, res as any);
    expect(subscriptionService.cancelSubscription).toHaveBeenCalledWith(1, { cancelReason: "不需要了" });
    expect(ok).toHaveBeenCalled();
  });

  it("getSubscriptionStatistics - 应返回订阅统计", async () => {
    (subscriptionService.getSubscriptionStatistics as any).mockResolvedValue({ total: 100 });
    const req = mockReq();
    const res = mockRes();
    await getSubscriptionStatistics(req as any, res as any);
    expect(subscriptionService.getSubscriptionStatistics).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });
});
