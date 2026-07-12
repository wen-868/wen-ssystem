import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/store/other.service", () => ({
  createHoldOrder: vi.fn(),
  listHoldOrders: vi.fn(),
  restoreHoldOrder: vi.fn(),
  deleteHoldOrder: vi.fn(),
  listCollectionLinks: vi.fn(),
  listPaymentOrders: vi.fn(),
  listRefundOrders: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as svc from "../../../services/store/other.service";
import { ok, fail } from "../../../shared/response";
import { createHoldOrder, listHoldOrders, restoreHoldOrder, deleteHoldOrder, listCollectionLinks, listPaymentOrders, listRefundOrders } from "../../../controllers/store/other.controller";

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

describe("store/other.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createHoldOrder - 应创建挂单", async () => {
    (svc.createHoldOrder as any).mockResolvedValue({ holdNo: "HOLD001" });
    const req = mockReq({ body: { items: [{ skuId: 1, skuName: "商品A", quantity: 2, unitPrice: 100, subtotalAmount: 200 }] } });
    const res = mockRes();
    await createHoldOrder(req as any, res as any);
    expect(svc.createHoldOrder).toHaveBeenCalledWith(expect.objectContaining({
      storeId: 1,
      tenantId: "t1",
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("listHoldOrders - 应返回挂单列表", async () => {
    (svc.listHoldOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listHoldOrders(req as any, res as any);
    expect(svc.listHoldOrders).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      tenantId: "t1",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("restoreHoldOrder - 挂单不存在应返回404", async () => {
    (svc.restoreHoldOrder as any).mockResolvedValue(null);
    const req = mockReq({ params: { holdNo: "HOLD999" } });
    const res = mockRes();
    await restoreHoldOrder(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("挂单不存在", "404");
  });

  it("restoreHoldOrder - 应恢复挂单", async () => {
    (svc.restoreHoldOrder as any).mockResolvedValue({ holdNo: "HOLD001" });
    const req = mockReq({ params: { holdNo: "HOLD001" } });
    const res = mockRes();
    await restoreHoldOrder(req as any, res as any);
    expect(svc.restoreHoldOrder).toHaveBeenCalledWith("HOLD001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("deleteHoldOrder - 应删除挂单", async () => {
    (svc.deleteHoldOrder as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { holdNo: "HOLD001" } });
    const res = mockRes();
    await deleteHoldOrder(req as any, res as any);
    expect(svc.deleteHoldOrder).toHaveBeenCalledWith("HOLD001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listCollectionLinks - 应返回收款链接列表", async () => {
    (svc.listCollectionLinks as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listCollectionLinks(req as any, res as any);
    expect(svc.listCollectionLinks).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      tenantId: "t1",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("listPaymentOrders - 应返回支付订单列表", async () => {
    (svc.listPaymentOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listPaymentOrders(req as any, res as any);
    expect(svc.listPaymentOrders).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      tenantId: "t1",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("listRefundOrders - 应返回退款订单列表", async () => {
    (svc.listRefundOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listRefundOrders(req as any, res as any);
    expect(svc.listRefundOrders).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      tenantId: "t1",
    });
    expect(ok).toHaveBeenCalled();
  });
});
