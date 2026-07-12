import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/purchase-order.service", () => ({
  listPurchaseOrders: vi.fn(),
  getPurchaseOrderDetail: vi.fn(),
  createPurchaseOrder: vi.fn(),
  updatePurchaseOrder: vi.fn(),
  cancelPurchaseOrder: vi.fn(),
  confirmPurchaseOrder: vi.fn(),
}));

vi.mock("../../../services/admin/purchase-in-stock.service", () => ({
  purchaseInStock: vi.fn(),
  listPurchaseInStocks: vi.fn(),
  getPurchaseInStockDetail: vi.fn(),
}));

vi.mock("../../../services/admin/purchase-return.service", () => ({
  purchaseReturn: vi.fn(),
  listPurchaseReturns: vi.fn(),
}));

vi.mock("../../../services/admin/purchase-payment.service", () => ({
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as purchaseOrderService from "../../../services/admin/purchase-order.service";
import { ok } from "../../../shared/response";
import {
  listPurchaseOrders,
  getPurchaseOrderDetail,
  createPurchaseOrder,
  updatePurchaseOrder,
  cancelPurchaseOrder,
  confirmPurchaseOrder,
  purchaseInStock,
  listPurchaseInStocks,
  getPurchaseInStockDetail,
  purchaseReturn,
  listPurchaseReturns,
} from "../../../controllers/admin/purchase-admin.controller";

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

describe("purchase-admin.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listPurchaseOrders - 应返回采购订单列表", async () => {
    (purchaseOrderService.listPurchaseOrders as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listPurchaseOrders(req as any, res as any);
    expect(purchaseOrderService.listPurchaseOrders).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getPurchaseOrderDetail - 应返回采购订单详情", async () => {
    (purchaseOrderService.getPurchaseOrderDetail as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await getPurchaseOrderDetail(req as any, res as any);
    expect(purchaseOrderService.getPurchaseOrderDetail).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createPurchaseOrder - 应创建采购订单", async () => {
    (purchaseOrderService.createPurchaseOrder as any).mockResolvedValue({ id: 1, orderNo: "PO20240101001" });
    const req = mockReq({
      body: {
        supplierId: 1,
        storeId: 1,
        items: [{ skuId: 1, quantity: 10, unitPrice: 100 }],
      },
    });
    const res = mockRes();
    await createPurchaseOrder(req as any, res as any);
    expect(purchaseOrderService.createPurchaseOrder).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("createPurchaseOrder - Zod验证失败应抛出错误", async () => {
    const req = mockReq({
      body: {
        supplierId: "invalid",
        storeId: "invalid",
        items: [],
      },
    });
    const res = mockRes();
    await expect(createPurchaseOrder(req as any, res as any)).rejects.toThrow();
    expect(purchaseOrderService.createPurchaseOrder).not.toHaveBeenCalled();
  });

  it("updatePurchaseOrder - 应更新采购订单", async () => {
    (purchaseOrderService.updatePurchaseOrder as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      params: { id: 1 },
      body: { remark: "更新备注" },
    });
    const res = mockRes();
    await updatePurchaseOrder(req as any, res as any);
    expect(purchaseOrderService.updatePurchaseOrder).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("cancelPurchaseOrder - 应取消采购订单", async () => {
    (purchaseOrderService.cancelPurchaseOrder as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await cancelPurchaseOrder(req as any, res as any);
    expect(purchaseOrderService.cancelPurchaseOrder).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("confirmPurchaseOrder - 应确认采购订单", async () => {
    (purchaseOrderService.confirmPurchaseOrder as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await confirmPurchaseOrder(req as any, res as any);
    expect(purchaseOrderService.confirmPurchaseOrder).toHaveBeenCalledWith(1, "t1", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("purchaseInStock - 应执行采购入库", async () => {
    const service = await import("../../../services/admin/purchase-in-stock.service.js");
    (service.purchaseInStock as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      params: { id: 1 },
      body: { items: [{ skuId: 1, quantity: 10 }] },
    });
    const res = mockRes();
    await purchaseInStock(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("purchaseInStock - Zod验证失败应抛出错误", async () => {
    const req = mockReq({
      params: { id: 1 },
      body: { items: [{ skuId: "invalid", quantity: "invalid" }] },
    });
    const res = mockRes();
    await expect(purchaseInStock(req as any, res as any)).rejects.toThrow();
  });

  it("listPurchaseInStocks - 应返回采购入库列表", async () => {
    const service = await import("../../../services/admin/purchase-in-stock.service.js");
    (service.listPurchaseInStocks as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listPurchaseInStocks(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("getPurchaseInStockDetail - 应返回采购入库详情", async () => {
    const service = await import("../../../services/admin/purchase-in-stock.service.js");
    (service.getPurchaseInStockDetail as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await getPurchaseInStockDetail(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("purchaseReturn - 应创建采购退货", async () => {
    const service = await import("../../../services/admin/purchase-return.service.js");
    (service.purchaseReturn as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      body: {
        supplierId: 1,
        storeId: 1,
        items: [{ skuId: 1, quantity: 5, unitPrice: 100 }],
      },
    });
    const res = mockRes();
    await purchaseReturn(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("purchaseReturn - Zod验证失败应抛出错误", async () => {
    const req = mockReq({
      body: {
        supplierId: "invalid",
        storeId: "invalid",
        items: [],
      },
    });
    const res = mockRes();
    await expect(purchaseReturn(req as any, res as any)).rejects.toThrow();
  });

  it("listPurchaseReturns - 应返回采购退货列表", async () => {
    const service = await import("../../../services/admin/purchase-return.service.js");
    (service.listPurchaseReturns as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listPurchaseReturns(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });
});