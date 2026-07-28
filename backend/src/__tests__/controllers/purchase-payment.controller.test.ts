import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/purchase-payment.service", () => ({
  list: vi.fn(),
  getDetail: vi.fn(),
  create: vi.fn(),
  approve: vi.fn(),
  voidPayment: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as purchasePaymentService from "@services/admin/purchase-payment.service";
import { ok } from "@shared/response";
import { list, getDetail, create, approve, voidPayment } from "@controllers/purchase-payment.controller";

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

describe("purchase-payment.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list - 应返回采购付款列表", async () => {
    (purchasePaymentService.list as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await list(req as any, res as any, vi.fn());
    expect(purchasePaymentService.list).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("list - 不传page和pageSize时使用默认值", async () => {
    (purchasePaymentService.list as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await list(req as any, res as any, vi.fn());
    expect(purchasePaymentService.list).toHaveBeenCalledWith(expect.objectContaining({
      page: 1, pageSize: 20, supplierId: undefined,
    }));
  });

  it("list - 传supplier_id时正确解析", async () => {
    (purchasePaymentService.list as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { supplier_id: "5" } });
    const res = mockRes();
    await list(req as any, res as any, vi.fn());
    expect(purchasePaymentService.list).toHaveBeenCalledWith(expect.objectContaining({
      supplierId: 5,
    }));
  });

  it("getDetail - 应返回付款单详情", async () => {
    (purchasePaymentService.getDetail as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { paymentNo: "PAY001" } });
    const res = mockRes();
    await getDetail(req as any, res as any, vi.fn());
    expect(purchasePaymentService.getDetail).toHaveBeenCalledWith("PAY001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("create - 应创建付款单", async () => {
    (purchasePaymentService.create as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { purchaseNo: "PO001", amount: 100 } });
    const res = mockRes();
    await create(req as any, res as any, vi.fn());
    expect(purchasePaymentService.create).toHaveBeenCalledWith(req.body, "t1", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });

  it("approve - 应审核付款单", async () => {
    (purchasePaymentService.approve as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { paymentNo: "PAY001" } });
    const res = mockRes();
    await approve(req as any, res as any, vi.fn());
    expect(purchasePaymentService.approve).toHaveBeenCalledWith("PAY001", "t1", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });

  it("voidPayment - 应作废付款单", async () => {
    (purchasePaymentService.voidPayment as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { paymentNo: "PAY001" } });
    const res = mockRes();
    await voidPayment(req as any, res as any, vi.fn());
    expect(purchasePaymentService.voidPayment).toHaveBeenCalledWith("PAY001", "t1", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });
});