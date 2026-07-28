import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/subscription-renewal.service", () => ({
  renewSubscription: vi.fn(),
  listExpiring: vi.fn(),
  listExpired: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as subscriptionRenewalService from "../../../services/admin/subscription-renewal.service";
import { ok } from "../../../shared/response";
import {
  renewSubscription,
  listExpiring,
  listExpired,
} from "../../../controllers/admin/subscription-renewal.controller";

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

describe("subscription-renewal.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renewSubscription - 应续费订阅", async () => {
    (subscriptionRenewalService.renewSubscription as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { subscriptionId: "1" }, body: { planId: 1, paymentMethod: "WECHAT" } });
    const res = mockRes();
    await renewSubscription(req as any, res as any, vi.fn());
    expect(subscriptionRenewalService.renewSubscription).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("renewSubscription - 返回错误码应直接返回", async () => {
    (subscriptionRenewalService.renewSubscription as any).mockResolvedValue({ code: 400, message: "参数错误" });
    const req = mockReq({ params: { subscriptionId: "1" }, body: {} });
    const res = mockRes();
    await renewSubscription(req as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ code: 400, message: "参数错误" });
  });

  it("listExpiring - 应返回即将到期的订阅", async () => {
    (subscriptionRenewalService.listExpiring as any).mockResolvedValue([]);
    const req = mockReq({ query: { days: 7 } });
    const res = mockRes();
    await listExpiring(req as any, res as any, vi.fn());
    expect(subscriptionRenewalService.listExpiring).toHaveBeenCalledWith(7, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listExpiring - 默认天数为7", async () => {
    (subscriptionRenewalService.listExpiring as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listExpiring(req as any, res as any, vi.fn());
    expect(subscriptionRenewalService.listExpiring).toHaveBeenCalledWith(7, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listExpired - 应返回已过期的订阅", async () => {
    (subscriptionRenewalService.listExpired as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listExpired(req as any, res as any, vi.fn());
    expect(subscriptionRenewalService.listExpired).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });
});
