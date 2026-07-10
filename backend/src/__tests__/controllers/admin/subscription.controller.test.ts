/**
 * 管理端订阅 controller 单元测试
 * 被测文件：src/controllers/admin/subscription.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  listSubscriptions: vi.fn(),
  getSubscription: vi.fn(),
  createSubscription: vi.fn(),
  changePlan: vi.fn(),
  cancelSubscription: vi.fn(),
  paySubscription: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/subscription.service.js", () => ({
  listSubscriptions: mocks.listSubscriptions,
  getSubscription: mocks.getSubscription,
  createSubscription: mocks.createSubscription,
  changePlan: mocks.changePlan,
  cancelSubscription: mocks.cancelSubscription,
  paySubscription: mocks.paySubscription,
}));

import {
  listSubscriptions,
  getSubscription,
  createSubscription,
  changePlan,
  cancelSubscription,
  paySubscription,
} from "../../../controllers/admin/subscription.controller.js";

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

describe("admin subscription.controller", () => {
  it("listSubscriptions 传递查询参数和分页", async () => {
    mocks.listSubscriptions.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ query: { status: "ACTIVE", paymentStatus: "PAID", page: "2", pageSize: "10" } });
    const res = mockRes();
    await listSubscriptions(req, res);
    expect(mocks.listSubscriptions).toHaveBeenCalledWith("t1", {
      tenantIdQuery: undefined,
      status: "ACTIVE",
      paymentStatus: "PAID",
      page: 2,
      pageSize: 10,
    });
  });

  it("listSubscriptions 使用默认分页", async () => {
    mocks.listSubscriptions.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listSubscriptions(req, res);
    expect(mocks.listSubscriptions).toHaveBeenCalledWith("t1", expect.objectContaining({ page: 1, pageSize: 20 }));
  });

  it("getSubscription 订阅存在时返回 ok", async () => {
    mocks.getSubscription.mockResolvedValue({ id: 5, status: "ACTIVE" });
    const req = mockReq({ params: { subscriptionId: "5" } });
    const res = mockRes();
    await getSubscription(req, res);
    expect(mocks.getSubscription).toHaveBeenCalledWith(5, "t1");
    expect(mocks.ok).toHaveBeenCalledWith({ id: 5, status: "ACTIVE" });
  });

  it("getSubscription 订阅不存在时回 404", async () => {
    mocks.getSubscription.mockResolvedValue(null);
    const req = mockReq({ params: { subscriptionId: "99" } });
    const res = mockRes();
    await getSubscription(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.fail).toHaveBeenCalledWith("订阅不存在", "404");
  });

  it("createSubscription 成功时返回 ok 并传递 user 信息", async () => {
    mocks.createSubscription.mockResolvedValue({ id: 1, status: "ACTIVE" });
    const req = mockReq({
      body: { tenantId: 2, planId: 1, startDate: "2026-07-11", paymentMethod: "WECHAT" },
    });
    const res = mockRes();
    await createSubscription(req, res);
    expect(mocks.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 2, planId: 1, startDate: "2026-07-11" }),
      1,
      "admin",
      "t1"
    );
    expect(mocks.ok).toHaveBeenCalled();
  });

  it("createSubscription service 返回带 code 的错误对象时回对应状态码", async () => {
    mocks.createSubscription.mockResolvedValue({ code: 400, msg: "套餐不可用" });
    const req = mockReq({
      body: { tenantId: 2, planId: 1, startDate: "2026-07-11" },
    });
    const res = mockRes();
    await createSubscription(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ code: 400, msg: "套餐不可用" });
  });

  it("createSubscription 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ body: { planId: 1 } });
    const res = mockRes();
    await expect(createSubscription(req, res)).rejects.toThrow();
    expect(mocks.createSubscription).not.toHaveBeenCalled();
  });

  it("changePlan 成功并传递 newPlanId", async () => {
    mocks.changePlan.mockResolvedValue({ id: 5, planId: 2 });
    const req = mockReq({ params: { subscriptionId: "5" }, body: { newPlanId: 2 } });
    const res = mockRes();
    await changePlan(req, res);
    expect(mocks.changePlan).toHaveBeenCalledWith(5, expect.objectContaining({ newPlanId: 2 }), 1, "admin", "t1");
    expect(mocks.ok).toHaveBeenCalled();
  });

  it("cancelSubscription 成功并传递 reason", async () => {
    mocks.cancelSubscription.mockResolvedValue({ id: 5, status: "CANCELLED" });
    const req = mockReq({ params: { subscriptionId: "5" }, body: { reason: "不再需要" } });
    const res = mockRes();
    await cancelSubscription(req, res);
    expect(mocks.cancelSubscription).toHaveBeenCalledWith(5, expect.objectContaining({ reason: "不再需要" }), 1, "admin", "t1");
  });

  it("paySubscription 成功并传递 paymentMethod", async () => {
    mocks.paySubscription.mockResolvedValue({ id: 5, paymentStatus: "PAID" });
    const req = mockReq({ params: { subscriptionId: "5" }, body: { paymentMethod: "ALIPAY" } });
    const res = mockRes();
    await paySubscription(req, res);
    expect(mocks.paySubscription).toHaveBeenCalledWith(5, expect.objectContaining({ paymentMethod: "ALIPAY" }), 1, "admin", "t1");
    expect(mocks.ok).toHaveBeenCalled();
  });
});
