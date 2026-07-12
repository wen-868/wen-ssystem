import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/store/order.service", () => ({
  listOrders: vi.fn(),
  getOrderDetail: vi.fn(),
  acceptOrder: vi.fn(),
  startDelivery: vi.fn(),
  completeDelivery: vi.fn(),
  rejectOrder: vi.fn(),
  cancelOrder: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as orderService from "../../../services/store/order.service";
import { ok, fail } from "../../../shared/response";
import { listOrders, getOrderDetail, acceptOrder, startDelivery, completeDelivery, rejectOrder, cancelOrder } from "../../../controllers/store/order.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "storeuser", storeId: 1 },
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

describe("store/order.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listOrders - 应返回订单列表", async () => {
    (orderService.listOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 10, status: "PENDING" } });
    const res = mockRes();
    await listOrders(req as any, res as any);
    expect(orderService.listOrders).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      storeId: 1,
      status: "PENDING",
      tenantId: "t1",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("getOrderDetail - 订单不存在应返回404", async () => {
    (orderService.getOrderDetail as any).mockResolvedValue(null);
    const req = mockReq({ params: { orderNo: "ORD999" } });
    const res = mockRes();
    await getOrderDetail(req as any, res as any);
    expect(orderService.getOrderDetail).toHaveBeenCalledWith("ORD999", "t1");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("订单不存在", "404");
  });

  it("getOrderDetail - 应返回订单详情", async () => {
    (orderService.getOrderDetail as any).mockResolvedValue({ orderNo: "ORD001" });
    const req = mockReq({ params: { orderNo: "ORD001" } });
    const res = mockRes();
    await getOrderDetail(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("acceptOrder - 订单不存在应返回404", async () => {
    (orderService.acceptOrder as any).mockResolvedValue(null);
    const req = mockReq({ params: { orderNo: "ORD999" } });
    const res = mockRes();
    await acceptOrder(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("订单不存在", "404");
  });

  it("acceptOrder - 应接单成功", async () => {
    (orderService.acceptOrder as any).mockResolvedValue({ orderNo: "ORD001" });
    const req = mockReq({ params: { orderNo: "ORD001" } });
    const res = mockRes();
    await acceptOrder(req as any, res as any);
    expect(orderService.acceptOrder).toHaveBeenCalledWith("ORD001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("startDelivery - 订单不存在或状态不允许应返回400", async () => {
    (orderService.startDelivery as any).mockResolvedValue(null);
    const req = mockReq({ params: { orderNo: "ORD999" } });
    const res = mockRes();
    await startDelivery(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalledWith("订单不存在或状态不允许开始配送", "400");
  });

  it("startDelivery - 应开始配送", async () => {
    (orderService.startDelivery as any).mockResolvedValue({ orderNo: "ORD001" });
    const req = mockReq({ params: { orderNo: "ORD001" } });
    const res = mockRes();
    await startDelivery(req as any, res as any);
    expect(orderService.startDelivery).toHaveBeenCalledWith("ORD001", "t1", 1, "storeuser");
    expect(ok).toHaveBeenCalled();
  });

  it("completeDelivery - 应完成配送", async () => {
    (orderService.completeDelivery as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { orderNo: "ORD001" } });
    const res = mockRes();
    await completeDelivery(req as any, res as any);
    expect(orderService.completeDelivery).toHaveBeenCalledWith("ORD001", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("rejectOrder - 应拒单", async () => {
    (orderService.rejectOrder as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { orderNo: "ORD001" } });
    const res = mockRes();
    await rejectOrder(req as any, res as any);
    expect(orderService.rejectOrder).toHaveBeenCalledWith("ORD001", 1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("cancelOrder - 应取消订单", async () => {
    (orderService.cancelOrder as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { orderNo: "ORD001" } });
    const res = mockRes();
    await cancelOrder(req as any, res as any);
    expect(orderService.cancelOrder).toHaveBeenCalledWith("ORD001", 1, "t1");
    expect(ok).toHaveBeenCalled();
  });
});
