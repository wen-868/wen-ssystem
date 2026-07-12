import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/purchase-return.service.js", () => ({
  list: vi.fn(),
  getDetail: vi.fn(),
  create: vi.fn(),
  approve: vi.fn(),
  voidReturn: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as purchaseReturnService from "../../../services/admin/purchase-return.service.js";
import { ok } from "../../../shared/response.js";
import { list, getDetail, create, approve, voidReturn } from "../../../controllers/purchase-return.controller.js";

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

describe("purchase-return.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list - 应返回采购退货列表", async () => {
    (purchaseReturnService.list as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await list(req as any, res as any);
    expect(purchaseReturnService.list).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getDetail - 应返回退货单详情", async () => {
    (purchaseReturnService.getDetail as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { returnNo: "RTN001" } });
    const res = mockRes();
    await getDetail(req as any, res as any);
    expect(purchaseReturnService.getDetail).toHaveBeenCalledWith("RTN001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("create - 应创建退货单", async () => {
    (purchaseReturnService.create as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { purchaseNo: "PO001" } });
    const res = mockRes();
    await create(req as any, res as any);
    expect(purchaseReturnService.create).toHaveBeenCalledWith(req.body, "t1", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });

  it("approve - 应审核退货单", async () => {
    (purchaseReturnService.approve as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { returnNo: "RTN001" } });
    const res = mockRes();
    await approve(req as any, res as any);
    expect(purchaseReturnService.approve).toHaveBeenCalledWith("RTN001", "t1", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });

  it("voidReturn - 应作废退货单", async () => {
    (purchaseReturnService.voidReturn as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { returnNo: "RTN001" } });
    const res = mockRes();
    await voidReturn(req as any, res as any);
    expect(purchaseReturnService.voidReturn).toHaveBeenCalledWith("RTN001", "t1", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });
});