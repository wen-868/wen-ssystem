import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/miniapp.service", () => ({
  devLogin: vi.fn(),
  devAuthLogin: vi.fn(),
  getProfile: vi.fn(),
  getProducts: vi.fn(),
  createOrder: vi.fn(),
  getOrders: vi.fn(),
  getOrderDetail: vi.fn(),
  confirmReceipt: vi.fn(),
  getStatements: vi.fn(),
  getStatementDetail: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("@shared/fulfillment", () => ({
  getSettlementType: vi.fn((customerType: string, type: string) => type),
}));

import * as miniappService from "@services/miniapp.service";
import { ok } from "@shared/response";
import {
  devLogin,
  devAuthLogin,
  getProfile,
  getProducts,
  createOrder,
  getOrders,
  getOrderDetail,
  confirmReceipt,
  getStatements,
  getStatementDetail,
} from "@controllers/admin/miniapp.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1 },
  query: {},
  params: {},
  body: {},
  headers: { "x-customer-type": "RETAIL" },
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

describe("miniapp.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devLogin - 应返回开发登录信息", () => {
    (miniappService.devLogin as any).mockReturnValue({ token: "test" });
    const req = mockReq();
    const res = mockRes();
    devLogin(req as any, res as any);
    expect(miniappService.devLogin).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("devAuthLogin - 应返回开发认证登录信息", () => {
    (miniappService.devAuthLogin as any).mockReturnValue({ token: "test" });
    const req = mockReq();
    const res = mockRes();
    devAuthLogin(req as any, res as any);
    expect(miniappService.devAuthLogin).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getProfile - 应返回用户配置", () => {
    (miniappService.getProfile as any).mockReturnValue({ customerType: "RETAIL" });
    const req = mockReq();
    const res = mockRes();
    getProfile(req as any, res as any);
    expect(miniappService.getProfile).toHaveBeenCalledWith("RETAIL");
    expect(ok).toHaveBeenCalled();
  });

  it("getProducts - 应获取商品列表", async () => {
    (miniappService.getProducts as any).mockResolvedValue([]);
    const req = mockReq({ query: { storeId: 1, keyword: "test" } });
    const res = mockRes();
    await getProducts(req as any, res as any);
    expect(miniappService.getProducts).toHaveBeenCalledWith(1, "test", "RETAIL");
    expect(ok).toHaveBeenCalled();
  });

  it("createOrder - 应创建订单", async () => {
    (miniappService.createOrder as any).mockResolvedValue({ orderNo: "ORD001" });
    const req = mockReq({
      body: {
        storeId: 1,
        fulfillmentType: "DELIVERY",
        items: [{ skuId: 1, qty: 1 }],
      },
      headers: { "x-customer-type": "RETAIL", "x-settlement-type": "ACCOUNT" },
    });
    const res = mockRes();
    await createOrder(req as any, res as any);
    expect(miniappService.createOrder).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("createOrder - zod验证失败", async () => {
    const req = mockReq({ body: { items: [] } });
    const res = mockRes();
    await expect(createOrder(req as any, res as any)).rejects.toThrow();
  });

  it("getOrders - 应获取订单列表", async () => {
    (miniappService.getOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 }, headers: { "x-anonymous-member-id": "test" } });
    const res = mockRes();
    await getOrders(req as any, res as any);
    expect(miniappService.getOrders).toHaveBeenCalledWith("t1", "test", 1, 20);
    expect(ok).toHaveBeenCalled();
  });

  it("getOrderDetail - 应获取订单详情", async () => {
    (miniappService.getOrderDetail as any).mockResolvedValue({ orderNo: "ORD001" });
    const req = mockReq({ params: { orderNo: "ORD001" }, headers: { "x-anonymous-member-id": "test" } });
    const res = mockRes();
    await getOrderDetail(req as any, res as any);
    expect(miniappService.getOrderDetail).toHaveBeenCalledWith("t1", "ORD001", "test");
    expect(ok).toHaveBeenCalled();
  });

  it("confirmReceipt - 应确认收货", async () => {
    (miniappService.confirmReceipt as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { orderNo: "ORD001" }, tenantId: "t1" });
    const res = mockRes();
    await confirmReceipt(req as any, res as any);
    expect(miniappService.confirmReceipt).toHaveBeenCalledWith("ORD001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getStatements - 应获取对账单列表", async () => {
    (miniappService.getStatements as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 }, headers: { "x-anonymous-member-id": "test" } });
    const res = mockRes();
    await getStatements(req as any, res as any);
    expect(miniappService.getStatements).toHaveBeenCalledWith("t1", "test", 1, 20);
    expect(ok).toHaveBeenCalled();
  });

  it("getStatementDetail - 应获取对账单详情", async () => {
    (miniappService.getStatementDetail as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: 1 }, headers: { "x-anonymous-member-id": "test" } });
    const res = mockRes();
    await getStatementDetail(req as any, res as any);
    expect(miniappService.getStatementDetail).toHaveBeenCalledWith("t1", 1, "test");
    expect(ok).toHaveBeenCalled();
  });

  it("getProfile - 不传x-customer-type时使用默认值RETAIL", () => {
    (miniappService.getProfile as any).mockReturnValue({ customerType: "RETAIL" });
    const req = mockReq({ headers: {} });
    const res = mockRes();
    getProfile(req as any, res as any);
    expect(miniappService.getProfile).toHaveBeenCalledWith("RETAIL");
  });

  it("getProducts - 不传参数时使用默认值", async () => {
    (miniappService.getProducts as any).mockResolvedValue([]);
    const req = mockReq({ query: {}, headers: {} });
    const res = mockRes();
    await getProducts(req as any, res as any);
    expect(miniappService.getProducts).toHaveBeenCalledWith(1, "", "RETAIL");
  });

  it("createOrder - 不传可选header时使用默认值", async () => {
    (miniappService.createOrder as any).mockResolvedValue({ orderNo: "ORD001" });
    const req = mockReq({
      body: {
        storeId: 1,
        fulfillmentType: "DELIVERY",
        items: [{ skuId: 1, qty: 1 }],
      },
      headers: {},
    });
    const res = mockRes();
    await createOrder(req as any, res as any);
    expect(miniappService.createOrder).toHaveBeenCalledWith("t1", expect.any(Object), "RETAIL", "", "ACCOUNT");
  });

  it("createOrder - 使用quantity代替qty时正确解析", async () => {
    (miniappService.createOrder as any).mockResolvedValue({ orderNo: "ORD001" });
    const req = mockReq({
      body: {
        storeId: 1,
        fulfillmentType: "PICKUP",
        items: [{ skuId: 1, quantity: 5 }],
      },
      headers: { "x-customer-type": "WHOLESALE" },
    });
    const res = mockRes();
    await createOrder(req as any, res as any);
    expect(miniappService.createOrder).toHaveBeenCalled();
  });

  it("getOrders - 不传参数时使用默认值", async () => {
    (miniappService.getOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {}, headers: {} });
    const res = mockRes();
    await getOrders(req as any, res as any);
    expect(miniappService.getOrders).toHaveBeenCalledWith("t1", "", 1, 20);
  });

  it("getOrderDetail - 不传x-anonymous-member-id时使用空字符串", async () => {
    (miniappService.getOrderDetail as any).mockResolvedValue({ orderNo: "ORD001" });
    const req = mockReq({ params: { orderNo: "ORD001" }, headers: {} });
    const res = mockRes();
    await getOrderDetail(req as any, res as any);
    expect(miniappService.getOrderDetail).toHaveBeenCalledWith("t1", "ORD001", "");
  });

  it("getStatements - 不传参数时使用默认值", async () => {
    (miniappService.getStatements as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {}, headers: {} });
    const res = mockRes();
    await getStatements(req as any, res as any);
    expect(miniappService.getStatements).toHaveBeenCalledWith("t1", "", 1, 20);
  });

  it("getStatementDetail - 不传x-anonymous-member-id时使用空字符串", async () => {
    (miniappService.getStatementDetail as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: 1 }, headers: {} });
    const res = mockRes();
    await getStatementDetail(req as any, res as any);
    expect(miniappService.getStatementDetail).toHaveBeenCalledWith("t1", 1, "");
  });
});