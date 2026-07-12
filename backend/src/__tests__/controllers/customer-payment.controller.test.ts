import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/customer-payment.service.js", () => ({
  list: vi.fn(),
  getDetail: vi.fn(),
  create: vi.fn(),
  voidPayment: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as customerPaymentService from "../../../services/admin/customer-payment.service.js";
import { ok } from "../../../shared/response.js";
import { list, getDetail, create, voidPayment } from "../../../controllers/customer-payment.controller.js";

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

describe("customer-payment.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list - 应返回客户收款列表", async () => {
    (customerPaymentService.list as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await list(req as any, res as any);
    expect(customerPaymentService.list).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getDetail - 应返回收款详情", async () => {
    (customerPaymentService.getDetail as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { receiptNo: "RCP001" } });
    const res = mockRes();
    await getDetail(req as any, res as any);
    expect(customerPaymentService.getDetail).toHaveBeenCalledWith("RCP001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("create - 应创建收款单", async () => {
    (customerPaymentService.create as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { customerId: 1, amount: 100 } });
    const res = mockRes();
    await create(req as any, res as any);
    expect(customerPaymentService.create).toHaveBeenCalledWith(req.body, "t1", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });

  it("voidPayment - 应作废收款单", async () => {
    (customerPaymentService.voidPayment as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { receiptNo: "RCP001" } });
    const res = mockRes();
    await voidPayment(req as any, res as any);
    expect(customerPaymentService.voidPayment).toHaveBeenCalledWith("RCP001", "t1", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });
});