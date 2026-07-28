import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/reconciliation.service", () => ({
  getCustomerReconciliation: vi.fn(),
  getCustomerReconciliationDetail: vi.fn(),
  confirmCustomerReconciliation: vi.fn(),
  getSupplierReconciliation: vi.fn(),
  getSupplierReconciliationDetail: vi.fn(),
  confirmSupplierReconciliation: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as reconciliationService from "../../../services/admin/reconciliation.service";
import { ok } from "../../../shared/response";
import {
  getCustomerReconciliation,
  getCustomerReconciliationDetail,
  confirmCustomerReconciliation,
  getSupplierReconciliation,
  getSupplierReconciliationDetail,
  confirmSupplierReconciliation,
} from "../../../controllers/admin/reconciliation.controller";

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

describe("reconciliation.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getCustomerReconciliation - 应返回客户对账列表", async () => {
    (reconciliationService.getCustomerReconciliation as any).mockResolvedValue([]);
    const req = mockReq({ query: { startDate: "2024-01-01", endDate: "2024-01-31" } });
    const res = mockRes();
    await getCustomerReconciliation(req as any, res as any, vi.fn());
    expect(reconciliationService.getCustomerReconciliation).toHaveBeenCalledWith("t1", "2024-01-01", "2024-01-31");
    expect(ok).toHaveBeenCalled();
  });

  it("getCustomerReconciliation - 日期参数可选", async () => {
    (reconciliationService.getCustomerReconciliation as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await getCustomerReconciliation(req as any, res as any, vi.fn());
    expect(reconciliationService.getCustomerReconciliation).toHaveBeenCalledWith("t1", undefined, undefined);
    expect(ok).toHaveBeenCalled();
  });

  it("getCustomerReconciliationDetail - 应返回客户对账详情", async () => {
    (reconciliationService.getCustomerReconciliationDetail as any).mockResolvedValue({ customerId: 1 });
    const req = mockReq({
      params: { customerId: 1 },
      query: { startDate: "2024-01-01", endDate: "2024-01-31" },
    });
    const res = mockRes();
    await getCustomerReconciliationDetail(req as any, res as any, vi.fn());
    expect(reconciliationService.getCustomerReconciliationDetail).toHaveBeenCalledWith(1, "t1", "2024-01-01", "2024-01-31");
    expect(ok).toHaveBeenCalled();
  });

  it("confirmCustomerReconciliation - 应确认客户对账", async () => {
    (reconciliationService.confirmCustomerReconciliation as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { customerId: 1 } });
    const res = mockRes();
    await confirmCustomerReconciliation(req as any, res as any, vi.fn());
    expect(reconciliationService.confirmCustomerReconciliation).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getSupplierReconciliation - 应返回供应商对账列表", async () => {
    (reconciliationService.getSupplierReconciliation as any).mockResolvedValue([]);
    const req = mockReq({ query: { startDate: "2024-01-01", endDate: "2024-01-31" } });
    const res = mockRes();
    await getSupplierReconciliation(req as any, res as any, vi.fn());
    expect(reconciliationService.getSupplierReconciliation).toHaveBeenCalledWith("t1", "2024-01-01", "2024-01-31");
    expect(ok).toHaveBeenCalled();
  });

  it("getSupplierReconciliation - 日期参数可选", async () => {
    (reconciliationService.getSupplierReconciliation as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await getSupplierReconciliation(req as any, res as any, vi.fn());
    expect(reconciliationService.getSupplierReconciliation).toHaveBeenCalledWith("t1", undefined, undefined);
    expect(ok).toHaveBeenCalled();
  });

  it("getSupplierReconciliationDetail - 应返回供应商对账详情", async () => {
    (reconciliationService.getSupplierReconciliationDetail as any).mockResolvedValue({ supplierId: 1 });
    const req = mockReq({
      params: { supplierId: 1 },
      query: { startDate: "2024-01-01", endDate: "2024-01-31" },
    });
    const res = mockRes();
    await getSupplierReconciliationDetail(req as any, res as any, vi.fn());
    expect(reconciliationService.getSupplierReconciliationDetail).toHaveBeenCalledWith(1, "t1", "2024-01-01", "2024-01-31");
    expect(ok).toHaveBeenCalled();
  });

  it("confirmSupplierReconciliation - 应确认供应商对账", async () => {
    (reconciliationService.confirmSupplierReconciliation as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { supplierId: 1 } });
    const res = mockRes();
    await confirmSupplierReconciliation(req as any, res as any, vi.fn());
    expect(reconciliationService.confirmSupplierReconciliation).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });
});