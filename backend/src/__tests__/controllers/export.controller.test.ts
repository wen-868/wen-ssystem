import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/export.service", () => ({
  exportCustomers: vi.fn(),
  exportSuppliers: vi.fn(),
  exportProducts: vi.fn(),
  exportInventory: vi.fn(),
  exportPurchaseOrders: vi.fn(),
  exportPayments: vi.fn(),
  exportSalesOrders: vi.fn(),
  exportAuditLogs: vi.fn(),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as exportService from "@services/admin/export.service";
import {
  exportCustomers,
  exportSuppliers,
  exportProducts,
  exportInventory,
  exportPurchaseOrders,
  exportPayments,
  exportSalesOrders,
  exportAuditLogs,
} from "@controllers/admin/export.controller";

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

describe("export.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exportCustomers - 应导出客户CSV", async () => {
    (exportService.exportCustomers as any).mockResolvedValue([{ id: 1, name: "test" }]);
    const req = mockReq();
    const res = mockRes();
    await exportCustomers(req as any, res as any, vi.fn());
    expect(exportService.exportCustomers).toHaveBeenCalledWith("t1", undefined);
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportSuppliers - 应导出供应商CSV", async () => {
    (exportService.exportSuppliers as any).mockResolvedValue([{ id: 1, name: "test" }]);
    const req = mockReq({ query: { keyword: "test", supplyType: "MAIN" } });
    const res = mockRes();
    await exportSuppliers(req as any, res as any, vi.fn());
    expect(exportService.exportSuppliers).toHaveBeenCalledWith("t1", "test", "MAIN");
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportProducts - 应导出商品CSV", async () => {
    (exportService.exportProducts as any).mockResolvedValue([{ id: 1, name: "test" }]);
    const req = mockReq({ query: { keyword: "test" } });
    const res = mockRes();
    await exportProducts(req as any, res as any, vi.fn());
    expect(exportService.exportProducts).toHaveBeenCalledWith("t1", "test");
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportInventory - 应导出库存CSV", async () => {
    (exportService.exportInventory as any).mockResolvedValue([{ id: 1 }]);
    const req = mockReq({ query: { storeId: "1", keyword: "test" } });
    const res = mockRes();
    await exportInventory(req as any, res as any, vi.fn());
    expect(exportService.exportInventory).toHaveBeenCalledWith("t1", "1", "test");
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportPurchaseOrders - 应导出采购订单CSV", async () => {
    (exportService.exportPurchaseOrders as any).mockResolvedValue([{ id: 1 }]);
    const req = mockReq({ query: { keyword: "test", status: "PENDING" } });
    const res = mockRes();
    await exportPurchaseOrders(req as any, res as any, vi.fn());
    expect(exportService.exportPurchaseOrders).toHaveBeenCalledWith("t1", "test", "PENDING");
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportPayments - 应导出付款单CSV", async () => {
    (exportService.exportPayments as any).mockResolvedValue([{ id: 1 }]);
    const req = mockReq({ query: { status: "PAID" } });
    const res = mockRes();
    await exportPayments(req as any, res as any, vi.fn());
    expect(exportService.exportPayments).toHaveBeenCalledWith("t1", "PAID");
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportSalesOrders - 应导出销售订单CSV", async () => {
    (exportService.exportSalesOrders as any).mockResolvedValue([{ id: 1 }]);
    const req = mockReq({ query: { keyword: "test", status: "COMPLETED", startDate: "2024-01-01", endDate: "2024-01-31" } });
    const res = mockRes();
    await exportSalesOrders(req as any, res as any, vi.fn());
    expect(exportService.exportSalesOrders).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportAuditLogs - 应导出审计日志CSV", async () => {
    (exportService.exportAuditLogs as any).mockResolvedValue([{ id: 1 }]);
    const req = mockReq({ query: { action: "CREATE", resourceType: "ORDER", dateStart: "2024-01-01", dateEnd: "2024-01-31" } });
    const res = mockRes();
    await exportAuditLogs(req as any, res as any, vi.fn());
    expect(exportService.exportAuditLogs).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportCustomers - 传keyword时正确解析", async () => {
    (exportService.exportCustomers as any).mockResolvedValue([]);
    const req = mockReq({ query: { keyword: "test" } });
    const res = mockRes();
    await exportCustomers(req as any, res as any, vi.fn());
    expect(exportService.exportCustomers).toHaveBeenCalledWith("t1", "test");
  });

  it("exportSuppliers - 不传参数时使用undefined", async () => {
    (exportService.exportSuppliers as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await exportSuppliers(req as any, res as any, vi.fn());
    expect(exportService.exportSuppliers).toHaveBeenCalledWith("t1", undefined, undefined);
  });

  it("exportProducts - 不传keyword时使用undefined", async () => {
    (exportService.exportProducts as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await exportProducts(req as any, res as any, vi.fn());
    expect(exportService.exportProducts).toHaveBeenCalledWith("t1", undefined);
  });

  it("exportInventory - 不传参数时使用undefined", async () => {
    (exportService.exportInventory as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await exportInventory(req as any, res as any, vi.fn());
    expect(exportService.exportInventory).toHaveBeenCalledWith("t1", undefined, undefined);
  });

  it("exportPurchaseOrders - 不传参数时使用undefined", async () => {
    (exportService.exportPurchaseOrders as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await exportPurchaseOrders(req as any, res as any, vi.fn());
    expect(exportService.exportPurchaseOrders).toHaveBeenCalledWith("t1", undefined, undefined);
  });

  it("exportPayments - 不传status时使用undefined", async () => {
    (exportService.exportPayments as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await exportPayments(req as any, res as any, vi.fn());
    expect(exportService.exportPayments).toHaveBeenCalledWith("t1", undefined);
  });

  it("exportSalesOrders - 不传参数时全部使用undefined", async () => {
    (exportService.exportSalesOrders as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await exportSalesOrders(req as any, res as any, vi.fn());
    expect(exportService.exportSalesOrders).toHaveBeenCalledWith("t1", undefined, undefined, undefined, undefined);
  });

  it("exportAuditLogs - 不传参数时全部使用undefined", async () => {
    (exportService.exportAuditLogs as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await exportAuditLogs(req as any, res as any, vi.fn());
    expect(exportService.exportAuditLogs).toHaveBeenCalledWith("t1", undefined, undefined, undefined, undefined);
  });
});