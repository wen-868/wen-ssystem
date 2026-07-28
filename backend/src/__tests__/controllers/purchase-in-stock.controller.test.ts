import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/purchase-in-stock.service", () => ({
  list: vi.fn(),
  getDetail: vi.fn(),
  create: vi.fn(),
  approve: vi.fn(),
  voidStock: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as purchaseInStockService from "@services/admin/purchase-in-stock.service";
import { ok } from "@shared/response";
import { list, getDetail, create, approve, voidStock } from "@controllers/purchase-in-stock.controller";

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

describe("purchase-in-stock.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list - 应返回采购入库列表", async () => {
    (purchaseInStockService.list as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await list(req as any, res as any, vi.fn());
    expect(purchaseInStockService.list).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getDetail - 应返回入库单详情", async () => {
    (purchaseInStockService.getDetail as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { stockNo: "STK001" } });
    const res = mockRes();
    await getDetail(req as any, res as any, vi.fn());
    expect(purchaseInStockService.getDetail).toHaveBeenCalledWith("STK001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("create - 应创建入库单", async () => {
    (purchaseInStockService.create as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { purchaseNo: "PO001" } });
    const res = mockRes();
    await create(req as any, res as any, vi.fn());
    expect(purchaseInStockService.create).toHaveBeenCalledWith(req.body, "t1", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });

  it("approve - 应审核入库单", async () => {
    (purchaseInStockService.approve as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { stockNo: "STK001" } });
    const res = mockRes();
    await approve(req as any, res as any, vi.fn());
    expect(purchaseInStockService.approve).toHaveBeenCalledWith("STK001", "t1", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });

  it("voidStock - 应作废入库单", async () => {
    (purchaseInStockService.voidStock as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { stockNo: "STK001" } });
    const res = mockRes();
    await voidStock(req as any, res as any, vi.fn());
    expect(purchaseInStockService.voidStock).toHaveBeenCalledWith("STK001", "t1", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });

  it("list - 不传page/pageSize时使用默认值", async () => {
    (purchaseInStockService.list as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await list(req as any, res as any, vi.fn());
    expect(purchaseInStockService.list).toHaveBeenCalledWith(expect.objectContaining({
      page: 1, pageSize: 20, supplierId: undefined,
    }));
  });

  it("list - 传supplier_id时正确解析", async () => {
    (purchaseInStockService.list as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { supplier_id: "5" } });
    const res = mockRes();
    await list(req as any, res as any, vi.fn());
    expect(purchaseInStockService.list).toHaveBeenCalledWith(expect.objectContaining({
      supplierId: 5,
    }));
  });
});