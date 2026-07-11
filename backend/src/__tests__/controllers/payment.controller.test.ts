import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../services/admin/payment.service.js", () => ({
  createPaymentOrder: vi.fn(),
  handleWxCallback: vi.fn(),
  createRefund: vi.fn(),
  getPaymentOrder: vi.fn(),
  listPaymentOrders: vi.fn(),
}));

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as paymentService from "../../services/admin/payment.service.js";
import { ok, fail } from "../../shared/response.js";
import { createPaymentController } from "../../controllers/payment.controller.js";

const mockWechatPay = {} as any;

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  headers: {},
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

describe("payment.controller", () => {
  let controller: ReturnType<typeof createPaymentController>;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = createPaymentController(mockWechatPay);
  });

  it("createPaymentOrder - 应创建支付订单", async () => {
    (paymentService.createPaymentOrder as any).mockResolvedValue({ payNo: "P001" });
    const req = mockReq({
      body: {
        sourceType: "MINIAPP_ORDER",
        sourceNo: "O001",
        amount: 100,
        openid: "openid123",
        description: "测试支付",
      },
    });
    const res = mockRes();
    await controller.createPaymentOrder(req as any, res as any);
    expect(paymentService.createPaymentOrder).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("handleWxCallback - 失败应返回400", async () => {
    (paymentService.handleWxCallback as any).mockResolvedValue({ success: false, message: "签名错误", code: "400" });
    const req = mockReq({ headers: { "x-wechatpay-signature": "sig" }, body: {} });
    const res = mockRes();
    await controller.handleWxCallback(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("签名错误", "400");
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("handleWxCallback - 成功应返回ok", async () => {
    (paymentService.handleWxCallback as any).mockResolvedValue({ success: true });
    const req = mockReq({ headers: { "x-wechatpay-signature": "sig" }, body: {} });
    const res = mockRes();
    await controller.handleWxCallback(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("createRefund - 失败应返回400", async () => {
    (paymentService.createRefund as any).mockResolvedValue({ success: false, message: "退款失败", code: "400" });
    const req = mockReq({ body: { payNo: "P001", amount: 50, reason: "商品问题" } });
    const res = mockRes();
    await controller.createRefund(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("退款失败", "400");
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("createRefund - 成功应返回ok", async () => {
    (paymentService.createRefund as any).mockResolvedValue({ success: true, data: { refundNo: "R001" } });
    const req = mockReq({ body: { payNo: "P001", amount: 50, reason: "商品问题" } });
    const res = mockRes();
    await controller.createRefund(req as any, res as any);
    expect(ok).toHaveBeenCalledWith({ refundNo: "R001" });
  });

  it("getPaymentOrder - 订单不存在应返回404", async () => {
    (paymentService.getPaymentOrder as any).mockResolvedValue(null);
    const req = mockReq({ params: { payNo: "P999" } });
    const res = mockRes();
    await controller.getPaymentOrder(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("支付订单不存在", "404");
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("getPaymentOrder - 应返回支付订单", async () => {
    (paymentService.getPaymentOrder as any).mockResolvedValue({ payNo: "P001", amount: 100 });
    const req = mockReq({ params: { payNo: "P001" } });
    const res = mockRes();
    await controller.getPaymentOrder(req as any, res as any);
    expect(paymentService.getPaymentOrder).toHaveBeenCalledWith("P001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listPaymentOrders - 应返回支付订单列表", async () => {
    (paymentService.listPaymentOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await controller.listPaymentOrders(req as any, res as any);
    expect(paymentService.listPaymentOrders).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });
});
