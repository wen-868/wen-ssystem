import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/export.service.js", () => ({
  exportCustomers: vi.fn(),
  exportSuppliers: vi.fn(),
  exportProducts: vi.fn(),
  exportInventory: vi.fn(),
  exportPurchaseOrders: vi.fn(),
  exportPayments: vi.fn(),
  exportSalesOrders: vi.fn(),
  exportAuditLogs: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as exportService from "../../../services/admin/export.service.js";
import {
  exportCustomers,
  exportSuppliers,
  exportProducts,
  exportInventory,
  exportPurchaseOrders,
  exportPayments,
  exportSalesOrders,
  exportAuditLogs,
} from "../../../controllers/export.controller.js";

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
    await exportCustomers(req as any, res as any);
    expect(exportService.exportCustomers).toHaveBeenCalledWith("t1", undefined);
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportSuppliers - 应导出供应商CSV", async () => {
    (exportService.exportSuppliers as any).mockResolvedValue([{ id: 1, name: "test" }]);
    const req = mockReq({ query: { keyword: "test", supplyType: "MAIN" } });
    const res = mockRes();
    await exportSuppliers(req as any, res as any);
    expect(exportService.exportSuppliers).toHaveBeenCalledWith("t1", "test", "MAIN");
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportProducts - 应导出商品CSV", async () => {
    (exportService.exportProducts as any).mockResolvedValue([{ id: 1, name: "test" }]);
    const req = mockReq({ query: { keyword: "test" } });
    const res = mockRes();
    await exportProducts(req as any, res as any);
    expect(exportService.exportProducts).toHaveBeenCalledWith("t1", "test");
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportInventory - 应导出库存CSV", async () => {
    (exportService.exportInventory as any).mockResolvedValue([{ id: 1 }]);
    const req = mockReq({ query: { storeId: "1", keyword: "test" } });
    const res = mockRes();
    await exportInventory(req as any, res as any);
    expect(exportService.exportInventory).toHaveBeenCalledWith("t1", "1", "test");
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportPurchaseOrders - 应导出采购订单CSV", async () => {
    (exportService.exportPurchaseOrders as any).mockResolvedValue([{ id: 1 }]);
    const req = mockReq({ query: { keyword: "test", status: "PENDING" } });
    const res = mockRes();
    await exportPurchaseOrders(req as any, res as any);
    expect(exportService.exportPurchaseOrders).toHaveBeenCalledWith("t1", "test", "PENDING");
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportPayments - 应导出付款单CSV", async () => {
    (exportService.exportPayments as any).mockResolvedValue([{ id: 1 }]);
    const req = mockReq({ query: { status: "PAID" } });
    const res = mockRes();
    await exportPayments(req as any, res as any);
    expect(exportService.exportPayments).toHaveBeenCalledWith("t1", "PAID");
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportSalesOrders - 应导出销售订单CSV", async () => {
    (exportService.exportSalesOrders as any).mockResolvedValue([{ id: 1 }]);
    const req = mockReq({ query: { keyword: "test", status: "COMPLETED", startDate: "2024-01-01", endDate: "2024-01-31" } });
    const res = mockRes();
    await exportSalesOrders(req as any, res as any);
    expect(exportService.exportSalesOrders).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("exportAuditLogs - 应导出审计日志CSV", async () => {
    (exportService.exportAuditLogs as any).mockResolvedValue([{ id: 1 }]);
    const req = mockReq({ query: { action: "CREATE", resourceType: "ORDER", dateStart: "2024-01-01", dateEnd: "2024-01-31" } });
    const res = mockRes();
    await exportAuditLogs(req as any, res as any);
    expect(exportService.exportAuditLogs).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });
});