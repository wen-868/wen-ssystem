import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/instant-retail/order-receiving.service.js", () => ({
  listOrders: vi.fn(),
  getOrderDetail: vi.fn(),
  confirmOrder: vi.fn(),
  cancelOrder: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as orderReceivingService from "../../../services/instant-retail/order-receiving.service.js";
import { ok, fail } from "../../../shared/response.js";
import { listOrders, getOrderDetail, confirmOrder, cancelOrder } from "../../../controllers/instant-retail/order-receiving.controller.js";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, storeId: 1 },
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

describe("instant-retail/order-receiving.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listOrders - 应返回订单列表", async () => {
    (orderReceivingService.listOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: "1", pageSize: "20", platform: "MEITUAN" } });
    const res = mockRes();
    await listOrders(req as any, res as any);
    expect(orderReceivingService.listOrders).toHaveBeenCalledWith(1, 20, "1", "MEITUAN", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listOrders - 无参数时使用默认值", async () => {
    (orderReceivingService.listOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listOrders(req as any, res as any);
    expect(orderReceivingService.listOrders).toHaveBeenCalledWith(1, 20, "1", null, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getOrderDetail - 订单不存在应返回404", async () => {
    (orderReceivingService.getOrderDetail as any).mockResolvedValue(null);
    const req = mockReq({ params: { platformOrderId: "ORD999" } });
    const res = mockRes();
    await getOrderDetail(req as any, res as any);
    expect(orderReceivingService.getOrderDetail).toHaveBeenCalledWith("ORD999", "t1");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("订单不存在", "404");
  });

  it("getOrderDetail - 应返回订单详情", async () => {
    (orderReceivingService.getOrderDetail as any).mockResolvedValue({ platformOrderId: "ORD001" });
    const req = mockReq({ params: { platformOrderId: "ORD001" } });
    const res = mockRes();
    await getOrderDetail(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("confirmOrder - 订单不存在应返回404", async () => {
    (orderReceivingService.confirmOrder as any).mockResolvedValue({ found: false });
    const req = mockReq({ params: { platformOrderId: "ORD999" } });
    const res = mockRes();
    await confirmOrder(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("订单不存在", "404");
  });

  it("confirmOrder - 平台配置不存在应返回404", async () => {
    (orderReceivingService.confirmOrder as any).mockResolvedValue({ found: true, configFound: false });
    const req = mockReq({ params: { platformOrderId: "ORD001" } });
    const res = mockRes();
    await confirmOrder(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("平台配置不存在", "404");
  });

  it("confirmOrder - 应确认订单", async () => {
    (orderReceivingService.confirmOrder as any).mockResolvedValue({
      found: true,
      configFound: true,
      platformOrderId: "ORD001",
      success: true,
      status: "CONFIRMED",
    });
    const req = mockReq({ params: { platformOrderId: "ORD001" } });
    const res = mockRes();
    await confirmOrder(req as any, res as any);
    expect(orderReceivingService.confirmOrder).toHaveBeenCalledWith("ORD001", "t1");
    expect(ok).toHaveBeenCalledWith({ platformOrderId: "ORD001", success: true, status: "CONFIRMED" });
  });

  it("cancelOrder - 订单不存在应返回404", async () => {
    (orderReceivingService.cancelOrder as any).mockResolvedValue({ found: false });
    const req = mockReq({ params: { platformOrderId: "ORD999" }, body: { reason: "缺货" } });
    const res = mockRes();
    await cancelOrder(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("订单不存在", "404");
  });

  it("cancelOrder - 平台配置不存在应返回404", async () => {
    (orderReceivingService.cancelOrder as any).mockResolvedValue({ found: true, configFound: false });
    const req = mockReq({ params: { platformOrderId: "ORD001" }, body: { reason: "缺货" } });
    const res = mockRes();
    await cancelOrder(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("平台配置不存在", "404");
  });

  it("cancelOrder - 应取消订单", async () => {
    (orderReceivingService.cancelOrder as any).mockResolvedValue({
      found: true,
      configFound: true,
      platformOrderId: "ORD001",
      success: true,
      status: "CANCELLED",
    });
    const req = mockReq({ params: { platformOrderId: "ORD001" }, body: { reason: "客户取消" } });
    const res = mockRes();
    await cancelOrder(req as any, res as any);
    expect(orderReceivingService.cancelOrder).toHaveBeenCalledWith("ORD001", "客户取消", "t1");
    expect(ok).toHaveBeenCalledWith({ platformOrderId: "ORD001", success: true, status: "CANCELLED" });
  });
});
