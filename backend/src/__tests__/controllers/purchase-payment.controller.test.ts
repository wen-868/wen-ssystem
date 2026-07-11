import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../services/admin/purchase-payment.service.js", () => ({
  list: vi.fn(),
  getDetail: vi.fn(),
  create: vi.fn(),
  approve: vi.fn(),
  voidPayment: vi.fn(),
}));

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as purchasePaymentService from "../../services/admin/purchase-payment.service.js";
import { ok, fail } from "../../shared/response.js";
import {
  list,
  getDetail,
  create,
  approve,
  voidPayment,
} from "../../controllers/purchase-payment.controller.js";

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

describe("purchase-payment.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list - 应返回采购付款列表", async () => {
    (purchasePaymentService.list as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await list(req as any, res as any);
    expect(purchasePaymentService.list).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getDetail - 应返回付款单详情", async () => {
    (purchasePaymentService.getDetail as any).mockResolvedValue({ paymentNo: "P001" });
    const req = mockReq({ params: { paymentNo: "P001" } });
    const res = mockRes();
    await getDetail(req as any, res as any);
    expect(purchasePaymentService.getDetail).toHaveBeenCalledWith("P001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("create - 应创建付款单", async () => {
    (purchasePaymentService.create as any).mockResolvedValue({ paymentNo: "P001" });
    const req = mockReq({ body: { supplierId: 1, amount: 1000 } });
    const res = mockRes();
    await create(req as any, res as any);
    expect(purchasePaymentService.create).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("approve - 应审核付款单", async () => {
    (purchasePaymentService.approve as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { paymentNo: "P001" } });
    const res = mockRes();
    await approve(req as any, res as any);
    expect(purchasePaymentService.approve).toHaveBeenCalledWith("P001", "t1", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });

  it("voidPayment - 应作废付款单", async () => {
    (purchasePaymentService.voidPayment as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { paymentNo: "P001" } });
    const res = mockRes();
    await voidPayment(req as any, res as any);
    expect(purchasePaymentService.voidPayment).toHaveBeenCalledWith("P001", "t1", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });
});
