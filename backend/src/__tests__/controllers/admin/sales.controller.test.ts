import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/payment-config.service.js", () => ({
  isProviderReady: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import { isProviderReady } from "../../../services/admin/payment-config.service.js";
import { requirePaymentReady } from "../../../controllers/admin/sales.controller.js";

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

  it("requirePaymentReady - 支付已配置应调用 next", async () => {
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
});
