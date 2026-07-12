import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/payment.service", () => ({
  createPaymentOrder: vi.fn(),
  handleWxCallback: vi.fn(),
  createRefund: vi.fn(),
  getPaymentOrder: vi.fn(),
  listPaymentOrders: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as paymentService from "@services/admin/payment.service";
import { ok, fail } from "@shared/response";
import { createPaymentController } from "@controllers/admin/payment.controller";

const mockWechatPay = {};
const { createPaymentOrder, handleWxCallback, createRefund, getPaymentOrder, listPaymentOrders } = createPaymentController(mockWechatPay as any);

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
  beforeEach(() => vi.clearAllMocks());

  it("createPaymentOrder - 应创建支付订单", async () => {
    (paymentService.createPaymentOrder as any).mockResolvedValue({ payNo: "PAY001" });
    const req = mockReq({
      body: {
        sourceType: "MINIAPP_ORDER",
        sourceNo: "ORD001",
        amount: 100,
      },
    });
    const res = mockRes();
    await createPaymentOrder(req as any, res as any);
    expect(paymentService.createPaymentOrder).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("createPaymentOrder - zod验证失败", async () => {
    const req = mockReq({ body: { sourceType: "INVALID", amount: -1 } });
    const res = mockRes();
    await expect(createPaymentOrder(req as any, res as any)).rejects.toThrow();
  });

  it("handleWxCallback - 应处理微信回调", async () => {
    (paymentService.handleWxCallback as any).mockResolvedValue({ success: true });
    const req = mockReq({ body: {}, headers: { "wechatpay-signature": "test" } });
    const res = mockRes();
    await handleWxCallback(req as any, res as any);
    expect(paymentService.handleWxCallback).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("handleWxCallback - 回调失败应返回错误", async () => {
    (paymentService.handleWxCallback as any).mockResolvedValue({ success: false, message: "签名验证失败", code: "400" });
    const req = mockReq({ body: {}, headers: {} });
    const res = mockRes();
    await handleWxCallback(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalled();
  });

  it("createRefund - 应创建退款", async () => {
    (paymentService.createRefund as any).mockResolvedValue({ success: true, data: { refundNo: "RFD001" } });
    const req = mockReq({ body: { payNo: "PAY001", amount: 100, reason: "退货退款" } });
    const res = mockRes();
    await createRefund(req as any, res as any);
    expect(paymentService.createRefund).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("createRefund - 退款失败应返回错误", async () => {
    (paymentService.createRefund as any).mockResolvedValue({ success: false, message: "退款失败", code: "500" });
    const req = mockReq({ body: { payNo: "PAY001", amount: 100, reason: "测试" } });
    const res = mockRes();
    await createRefund(req as any, res as any);
    expect(res.status).toHaveBeenCalled();
    expect(fail).toHaveBeenCalled();
  });

  it("getPaymentOrder - 应获取支付订单", async () => {
    (paymentService.getPaymentOrder as any).mockResolvedValue({ payNo: "PAY001" });
    const req = mockReq({ params: { payNo: "PAY001" } });
    const res = mockRes();
    await getPaymentOrder(req as any, res as any);
    expect(paymentService.getPaymentOrder).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getPaymentOrder - 订单不存在应返回404", async () => {
    (paymentService.getPaymentOrder as any).mockResolvedValue(null);
    const req = mockReq({ params: { payNo: "PAY001" } });
    const res = mockRes();
    await getPaymentOrder(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalled();
  });

  it("listPaymentOrders - 应返回支付订单列表", async () => {
    (paymentService.listPaymentOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listPaymentOrders(req as any, res as any);
    expect(paymentService.listPaymentOrders).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });
});