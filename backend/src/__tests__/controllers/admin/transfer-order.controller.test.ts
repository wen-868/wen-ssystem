import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/transfer-order.service", () => ({
  createTransferOrder: vi.fn(),
  listTransferOrders: vi.fn(),
  getTransferStatistics: vi.fn(),
  getTransferOrderDetail: vi.fn(),
  updateTransferOrder: vi.fn(),
  submitTransferOrder: vi.fn(),
  approveTransferOrder: vi.fn(),
  rejectTransferOrder: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as transferOrderService from "../../../services/transfer-order.service";
import { ok } from "../../../shared/response";
import {
  createTransferOrder,
  listTransferOrders,
  getTransferStatistics,
  getTransferOrderDetail,
  updateTransferOrder,
  submitTransferOrder,
  approveTransferOrder,
  rejectTransferOrder,
} from "../../../controllers/admin/transfer-order.controller";

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

describe("transfer-order.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createTransferOrder - 应创建调拨单", async () => {
    (transferOrderService.createTransferOrder as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      body: {
        fromStoreId: 1,
        toStoreId: 2,
        items: [{ skuId: 1, skuName: "商品1", quantity: 10, unitPrice: 100 }],
      },
    });
    const res = mockRes();
    await createTransferOrder(req as any, res as any);
    expect(transferOrderService.createTransferOrder).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listTransferOrders - 应返回调拨单列表", async () => {
    (transferOrderService.listTransferOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listTransferOrders(req as any, res as any);
    expect(transferOrderService.listTransferOrders).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getTransferStatistics - 应返回调拨统计", async () => {
    (transferOrderService.getTransferStatistics as any).mockResolvedValue({ total: 0 });
    const req = mockReq();
    const res = mockRes();
    await getTransferStatistics(req as any, res as any);
    expect(transferOrderService.getTransferStatistics).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getTransferOrderDetail - 应返回调拨单详情", async () => {
    (transferOrderService.getTransferOrderDetail as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getTransferOrderDetail(req as any, res as any);
    expect(transferOrderService.getTransferOrderDetail).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("updateTransferOrder - 应更新调拨单", async () => {
    (transferOrderService.updateTransferOrder as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: { remark: "更新备注" } });
    const res = mockRes();
    await updateTransferOrder(req as any, res as any);
    expect(transferOrderService.updateTransferOrder).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("submitTransferOrder - 应提交调拨单", async () => {
    (transferOrderService.submitTransferOrder as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await submitTransferOrder(req as any, res as any);
    expect(transferOrderService.submitTransferOrder).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("approveTransferOrder - 应审批通过调拨单", async () => {
    (transferOrderService.approveTransferOrder as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await approveTransferOrder(req as any, res as any);
    expect(transferOrderService.approveTransferOrder).toHaveBeenCalledWith(1, "t1", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("rejectTransferOrder - 应驳回调拨单", async () => {
    (transferOrderService.rejectTransferOrder as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await rejectTransferOrder(req as any, res as any);
    expect(transferOrderService.rejectTransferOrder).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createTransferOrder - user无id时userId为null", async () => {
    (transferOrderService.createTransferOrder as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      body: {
        fromStoreId: 1, toStoreId: 2,
        items: [{ skuId: 1, skuName: "商品1", quantity: 10, unitPrice: 100 }],
      },
      user: { username: "admin" },
    });
    const res = mockRes();
    await createTransferOrder(req as any, res as any);
    expect(transferOrderService.createTransferOrder).toHaveBeenCalledWith(expect.objectContaining({
      userId: null,
    }));
  });

  it("approveTransferOrder - user无id时userId为null", async () => {
    (transferOrderService.approveTransferOrder as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, user: { username: "admin" } });
    const res = mockRes();
    await approveTransferOrder(req as any, res as any);
    expect(transferOrderService.approveTransferOrder).toHaveBeenCalledWith(1, "t1", null);
  });
});
