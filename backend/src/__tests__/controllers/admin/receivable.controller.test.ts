import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/receivable.service", () => ({
  listReceivables: vi.fn(),
  listPayables: vi.fn(),
  getReceivablesAging: vi.fn(),
  getPayablesAging: vi.fn(),
  getReceivableDetail: vi.fn(),
  getPayableDetail: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as receivableService from "../../../services/admin/receivable.service";
import { ok } from "../../../shared/response";
import {
  listReceivables, listPayables, getReceivablesAging, getPayablesAging,
  getReceivableDetail, getPayableDetail
} from "../../../controllers/admin/receivable.controller";

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

describe("receivable.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listReceivables - 应返回应收列表", async () => {
    (receivableService.listReceivables as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listReceivables(req as any, res as any, vi.fn());
    expect(receivableService.listReceivables).toHaveBeenCalledWith({
      customerId: undefined, status: undefined, page: 1, pageSize: 20, tenantId: "t1"
    });
    expect(ok).toHaveBeenCalled();
  });

  it("listReceivables - 应支持按客户筛选", async () => {
    (receivableService.listReceivables as any).mockResolvedValue({ total: 1, records: [] });
    const req = mockReq({ query: { customerId: 5, status: "PENDING" } });
    const res = mockRes();
    await listReceivables(req as any, res as any, vi.fn());
    expect(receivableService.listReceivables).toHaveBeenCalledWith({
      customerId: 5, status: "PENDING", page: 1, pageSize: 20, tenantId: "t1"
    });
    expect(ok).toHaveBeenCalled();
  });

  it("listReceivables - service抛出异常应被捕获", async () => {
    const error = new Error("查询应收失败");
    (receivableService.listReceivables as any).mockRejectedValue(error);
    const req = mockReq();
    const res = mockRes();
    await expect(listReceivables(req as any, res as any, vi.fn())).rejects.toThrow(error);
  });

  it("listPayables - 应返回应付列表", async () => {
    (receivableService.listPayables as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listPayables(req as any, res as any, vi.fn());
    expect(receivableService.listPayables).toHaveBeenCalledWith({
      supplierId: undefined, status: undefined, page: 1, pageSize: 20, tenantId: "t1"
    });
    expect(ok).toHaveBeenCalled();
  });

  it("listPayables - 应支持按供应商筛选", async () => {
    (receivableService.listPayables as any).mockResolvedValue({ total: 1, records: [] });
    const req = mockReq({ query: { supplierId: "3", status: "PENDING" } });
    const res = mockRes();
    await listPayables(req as any, res as any, vi.fn());
    expect(receivableService.listPayables).toHaveBeenCalledWith({
      supplierId: 3, status: "PENDING", page: 1, pageSize: 20, tenantId: "t1"
    });
    expect(ok).toHaveBeenCalled();
  });

  it("getReceivablesAging - 应返回应收账龄", async () => {
    (receivableService.getReceivablesAging as any).mockResolvedValue({ total: 1000 });
    const req = mockReq();
    const res = mockRes();
    await getReceivablesAging(req as any, res as any, vi.fn());
    expect(receivableService.getReceivablesAging).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getPayablesAging - 应返回应付账龄", async () => {
    (receivableService.getPayablesAging as any).mockResolvedValue({ total: 500 });
    const req = mockReq();
    const res = mockRes();
    await getPayablesAging(req as any, res as any, vi.fn());
    expect(receivableService.getPayablesAging).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getReceivableDetail - 应返回应收详情", async () => {
    (receivableService.getReceivableDetail as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getReceivableDetail(req as any, res as any, vi.fn());
    expect(receivableService.getReceivableDetail).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getReceivableDetail - 应收不存在应抛出异常", async () => {
    const error = new Error("应收不存在");
    (receivableService.getReceivableDetail as any).mockRejectedValue(error);
    const req = mockReq({ params: { id: "999" } });
    const res = mockRes();
    await expect(getReceivableDetail(req as any, res as any, vi.fn())).rejects.toThrow(error);
  });

  it("getPayableDetail - 应返回应付详情", async () => {
    (receivableService.getPayableDetail as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getPayableDetail(req as any, res as any, vi.fn());
    expect(receivableService.getPayableDetail).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getPayableDetail - 应付不存在应抛出异常", async () => {
    const error = new Error("应付不存在");
    (receivableService.getPayableDetail as any).mockRejectedValue(error);
    const req = mockReq({ params: { id: "999" } });
    const res = mockRes();
    await expect(getPayableDetail(req as any, res as any, vi.fn())).rejects.toThrow(error);
  });
});