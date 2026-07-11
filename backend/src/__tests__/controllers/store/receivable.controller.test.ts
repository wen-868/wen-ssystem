import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/store/receivable.service.js", () => ({
  listReceivables: vi.fn(),
  paymentOnReceivable: vi.fn(),
  getDashboard: vi.fn(),
  getDailySales: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as svc from "../../../services/store/receivable.service.js";
import { ok } from "../../../shared/response.js";
import { listReceivables, paymentOnReceivable, getDashboard, getDailySales } from "../../../controllers/store/receivable.controller.js";

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

describe("store/receivable.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listReceivables - 应返回应收款列表", async () => {
    (svc.listReceivables as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20, status: "UNPAID", keyword: "客户" } });
    const res = mockRes();
    await listReceivables(req as any, res as any);
    expect(svc.listReceivables).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      storeId: 1,
      status: "UNPAID",
      keyword: "客户",
      tenantId: "t1",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("paymentOnReceivable - 应收款", async () => {
    (svc.paymentOnReceivable as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { receivableNo: "REC001" }, body: { amount: 100, paymentMethod: "CASH" } });
    const res = mockRes();
    await paymentOnReceivable(req as any, res as any);
    expect(svc.paymentOnReceivable).toHaveBeenCalledWith({
      receivableNo: "REC001",
      amount: 100,
      paymentMethod: "CASH",
      remark: undefined,
      tenantId: "t1",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("paymentOnReceivable - 应带备注收款", async () => {
    (svc.paymentOnReceivable as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { receivableNo: "REC001" }, body: { amount: 200, paymentMethod: "ALIPAY", remark: "测试备注" } });
    const res = mockRes();
    await paymentOnReceivable(req as any, res as any);
    expect(svc.paymentOnReceivable).toHaveBeenCalledWith(expect.objectContaining({
      remark: "测试备注",
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("getDashboard - 应返回仪表盘数据", async () => {
    (svc.getDashboard as any).mockResolvedValue({ totalReceivable: 1000 });
    const req = mockReq();
    const res = mockRes();
    await getDashboard(req as any, res as any);
    expect(svc.getDashboard).toHaveBeenCalledWith({
      storeId: 1,
      tenantId: "t1",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("getDashboard - 应使用 query 中的 storeId", async () => {
    (svc.getDashboard as any).mockResolvedValue({});
    const req = mockReq({ query: { storeId: "3" } });
    const res = mockRes();
    await getDashboard(req as any, res as any);
    expect(svc.getDashboard).toHaveBeenCalledWith(expect.objectContaining({
      storeId: 3,
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("getDailySales - 应返回日销售数据", async () => {
    (svc.getDailySales as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getDailySales(req as any, res as any);
    expect(svc.getDailySales).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getDailySales - 应使用 query 中的 storeId", async () => {
    (svc.getDailySales as any).mockResolvedValue([]);
    const req = mockReq({ query: { storeId: "5" } });
    const res = mockRes();
    await getDailySales(req as any, res as any);
    expect(svc.getDailySales).toHaveBeenCalledWith(5, "t1");
    expect(ok).toHaveBeenCalled();
  });
});
