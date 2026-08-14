import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/miniapp/checkout.service", () => ({
  checkoutPreview: vi.fn(),
  createCheckoutOrder: vi.fn(),
}));

vi.mock("../../../shared/fulfillment", () => ({
  getSettlementType: vi.fn((customerType: string, headerValue?: string) => {
    if (customerType === "WHOLESALE") {
      return headerValue || "ACCOUNT";
    }
    return "CASH";
  }),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as checkoutService from "../../../services/miniapp/checkout.service";
import { ok, fail } from "../../../shared/response";
import { checkoutPreview, createCheckoutOrder } from "../../../controllers/miniapp/checkout.controller";

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

describe("miniapp/checkout.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checkoutPreview - 结算预览成功应返回 ok", async () => {
    (checkoutService.checkoutPreview as any).mockResolvedValue({ success: true, data: { totalAmount: 100 } });
    const req = mockReq({
      headers: { "x-customer-type": "RETAIL" },
      body: { storeId: 1, skuIds: [1, 2] },
    });
    const res = mockRes();
    await checkoutPreview(req as any, res as any, vi.fn());
    expect(checkoutService.checkoutPreview).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "t1",
      customerId: 1,
      customerType: "RETAIL",
      storeId: 1,
      skuIds: [1, 2],
    }));
    expect(ok).toHaveBeenCalledWith({ totalAmount: 100 });
  });

  it("checkoutPreview - 结算失败应返回400", async () => {
    (checkoutService.checkoutPreview as any).mockResolvedValue({ success: false, message: "商品已下架" });
    const req = mockReq({ body: { storeId: 1, skuIds: [1] } });
    const res = mockRes();
    await checkoutPreview(req as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalledWith("商品已下架");
  });

  it("checkoutPreview - 失败无 message 时使用默认提示", async () => {
    (checkoutService.checkoutPreview as any).mockResolvedValue({ success: false });
    const req = mockReq({ body: { storeId: 1 } });
    const res = mockRes();
    await checkoutPreview(req as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalledWith("结算失败");
  });

  it("checkoutPreview - 默认 customerType 为 RETAIL", async () => {
    (checkoutService.checkoutPreview as any).mockResolvedValue({ success: true, data: {} });
    const req = mockReq({ headers: {}, body: { storeId: 1 } });
    const res = mockRes();
    await checkoutPreview(req as any, res as any, vi.fn());
    expect(checkoutService.checkoutPreview).toHaveBeenCalledWith(expect.objectContaining({
      customerType: "RETAIL",
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("createCheckoutOrder - 应创建结算订单（零售客户）", async () => {
    (checkoutService.createCheckoutOrder as any).mockResolvedValue({ orderNo: "ORD001" });
    const req = mockReq({
      headers: { "x-customer-type": "RETAIL" },
      body: {
        storeId: 1,
        fulfillmentType: "DELIVERY",
        receiverName: "张三",
        receiverMobile: "13800138000",
        receiverAddress: "测试地址",
        skuIds: [1, 2],
      },
    });
    const res = mockRes();
    await createCheckoutOrder(req as any, res as any, vi.fn());
    expect(checkoutService.createCheckoutOrder).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "t1",
      customerId: 1,
      customerType: "RETAIL",
      storeId: 1,
      fulfillmentType: "DELIVERY",
      receiverName: "张三",
      receiverMobile: "13800138000",
      receiverAddress: "测试地址",
      skuIds: [1, 2],
      settlementType: "CASH",
    }));
    expect(ok).toHaveBeenCalledWith({ orderNo: "ORD001" });
  });

  it("createCheckoutOrder - 批发客户应使用 ACCOUNT 结算类型", async () => {
    (checkoutService.createCheckoutOrder as any).mockResolvedValue({ orderNo: "ORD002" });
    const req = mockReq({
      headers: { "x-customer-type": "WHOLESALE", "x-settlement-type": "ACCOUNT" },
      body: { storeId: 1 },
    });
    const res = mockRes();
    await createCheckoutOrder(req as any, res as any, vi.fn());
    expect(checkoutService.createCheckoutOrder).toHaveBeenCalledWith(expect.objectContaining({
      customerType: "WHOLESALE",
      settlementType: "ACCOUNT",
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("createCheckoutOrder - 默认 fulfillmentType 为 DELIVERY", async () => {
    (checkoutService.createCheckoutOrder as any).mockResolvedValue({ orderNo: "ORD001" });
    const req = mockReq({ body: { storeId: 1 } });
    const res = mockRes();
    await createCheckoutOrder(req as any, res as any, vi.fn());
    expect(checkoutService.createCheckoutOrder).toHaveBeenCalledWith(expect.objectContaining({
      fulfillmentType: "DELIVERY",
    }));
    expect(ok).toHaveBeenCalled();
  });
});
