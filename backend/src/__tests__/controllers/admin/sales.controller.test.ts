import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/payment-config.service", () => ({
  isProviderReady: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import { isProviderReady } from "../../../services/admin/payment-config.service";
import { requirePaymentReady } from "../../../controllers/admin/sales.controller";

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

describe("sales.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requirePaymentReady - 支付已配置应调用next", async () => {
    (isProviderReady as any).mockResolvedValue(true);
    const req = mockReq({ body: { provider: "wechat" } });
    const res = mockRes();
    const next = vi.fn();
    await requirePaymentReady(req as any, res as any, next);
    expect(isProviderReady).toHaveBeenCalledWith("t1", "wechat");
    expect(next).toHaveBeenCalled();
  });

  it("requirePaymentReady - 未配置应返回400", async () => {
    (isProviderReady as any).mockResolvedValue(false);
    const req = mockReq({ body: { provider: "wechat" } });
    const res = mockRes();
    const next = vi.fn();
    await requirePaymentReady(req as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      code: "PAYMENT_NOT_CONFIGURED",
      message: "请先配置微信支付",
      provider: "wechat",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("requirePaymentReady - 默认provider为wechat", async () => {
    (isProviderReady as any).mockResolvedValue(true);
    const req = mockReq({ body: {}, query: {} });
    const res = mockRes();
    const next = vi.fn();
    await requirePaymentReady(req as any, res as any, next);
    expect(isProviderReady).toHaveBeenCalledWith("t1", "wechat");
  });

  it("requirePaymentReady - 从query获取provider", async () => {
    (isProviderReady as any).mockResolvedValue(true);
    const req = mockReq({ query: { provider: "alipay" } });
    const res = mockRes();
    const next = vi.fn();
    await requirePaymentReady(req as any, res as any, next);
    expect(isProviderReady).toHaveBeenCalledWith("t1", "alipay");
  });

  it("requirePaymentReady - service抛出异常应被捕获", async () => {
    const error = new Error("支付配置查询失败");
    (isProviderReady as any).mockRejectedValue(error);
    const req = mockReq({ body: { provider: "wechat" } });
    const res = mockRes();
    const next = vi.fn();
    await expect(requirePaymentReady(req as any, res as any, next)).rejects.toThrow(error);
    expect(next).not.toHaveBeenCalled();
  });

  it("requirePaymentReady - 从body获取provider优先级高于query", async () => {
    (isProviderReady as any).mockResolvedValue(true);
    const req = mockReq({ body: { provider: "wechat" }, query: { provider: "alipay" } });
    const res = mockRes();
    const next = vi.fn();
    await requirePaymentReady(req as any, res as any, next);
    expect(isProviderReady).toHaveBeenCalledWith("t1", "wechat");
  });
});