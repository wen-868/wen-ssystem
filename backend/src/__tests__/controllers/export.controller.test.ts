import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../services/admin/export.service.js", () => ({
  exportCustomers: vi.fn(),
  exportSuppliers: vi.fn(),
  exportProducts: vi.fn(),
  exportInventory: vi.fn(),
  exportPurchaseOrders: vi.fn(),
  exportPayments: vi.fn(),
  exportSalesOrders: vi.fn(),
  exportAuditLogs: vi.fn(),
}));

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as exportService from "../../services/admin/export.service.js";
import { ok, fail } from "../../shared/response.js";
import {
  exportCustomers,
  exportSuppliers,
  exportProducts,
  exportInventory,
  exportPurchaseOrders,
  exportPayments,
  exportSalesOrders,
  exportAuditLogs,
} from "../../controllers/export.controller.js";

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

describe("export.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exportCustomers - 应导出客户CSV", async () => {
    (exportService.exportCustomers as any).mockResolvedValue([]);
    const req = mockReq({ query: { keyword: "" } });
    const res = mockRes();
    await exportCustomers(req as any, res as any);
    expect(exportService.exportCustomers).toHaveBeenCalledWith("t1", undefined);
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportSuppliers - 应导出供应商CSV", async () => {
    (exportService.exportSuppliers as any).mockResolvedValue([]);
    const req = mockReq({ query: { keyword: "", supplyType: "" } });
    const res = mockRes();
    await exportSuppliers(req as any, res as any);
    expect(exportService.exportSuppliers).toHaveBeenCalledWith("t1", undefined, undefined);
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportProducts - 应导出商品CSV", async () => {
    (exportService.exportProducts as any).mockResolvedValue([]);
    const req = mockReq({ query: { keyword: "" } });
    const res = mockRes();
    await exportProducts(req as any, res as any);
    expect(exportService.exportProducts).toHaveBeenCalledWith("t1", undefined);
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportInventory - 应导出库存CSV", async () => {
    (exportService.exportInventory as any).mockResolvedValue([]);
    const req = mockReq({ query: { storeId: "", keyword: "" } });
    const res = mockRes();
    await exportInventory(req as any, res as any);
    expect(exportService.exportInventory).toHaveBeenCalledWith("t1", undefined, undefined);
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportPurchaseOrders - 应导出采购订单CSV", async () => {
    (exportService.exportPurchaseOrders as any).mockResolvedValue([]);
    const req = mockReq({ query: { keyword: "", status: "" } });
    const res = mockRes();
    await exportPurchaseOrders(req as any, res as any);
    expect(exportService.exportPurchaseOrders).toHaveBeenCalledWith("t1", undefined, undefined);
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportPayments - 应导出付款单CSV", async () => {
    (exportService.exportPayments as any).mockResolvedValue([]);
    const req = mockReq({ query: { status: "" } });
    const res = mockRes();
    await exportPayments(req as any, res as any);
    expect(exportService.exportPayments).toHaveBeenCalledWith("t1", undefined);
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportSalesOrders - 应导出销售订单CSV", async () => {
    (exportService.exportSalesOrders as any).mockResolvedValue([]);
    const req = mockReq({ query: { keyword: "", status: "", startDate: "", endDate: "" } });
    const res = mockRes();
    await exportSalesOrders(req as any, res as any);
    expect(exportService.exportSalesOrders).toHaveBeenCalledWith("t1", undefined, undefined, undefined, undefined);
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportAuditLogs - 应导出审计日志CSV", async () => {
    (exportService.exportAuditLogs as any).mockResolvedValue([]);
    const req = mockReq({ query: { action: "", resourceType: "", dateStart: "", dateEnd: "" } });
    const res = mockRes();
    await exportAuditLogs(req as any, res as any);
    expect(exportService.exportAuditLogs).toHaveBeenCalledWith("t1", undefined, undefined, undefined, undefined);
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });
});
