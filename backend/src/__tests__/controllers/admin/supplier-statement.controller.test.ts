import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/supplier-statement.service", () => ({
  generateSupplierStatement: vi.fn(),
  listSupplierStatements: vi.fn(),
  getSupplierStatementDetail: vi.fn(),
  confirmSupplierStatement: vi.fn(),
  disputeSupplierStatement: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as supplierStatementService from "../../../services/admin/supplier-statement.service";
import { ok } from "../../../shared/response";
import {
  generateSupplierStatement,
  listSupplierStatements,
  getSupplierStatementDetail,
  confirmSupplierStatement,
  disputeSupplierStatement,
} from "../../../controllers/admin/supplier-statement.controller";

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

describe("supplier-statement.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generateSupplierStatement - 应生成供应商对账单", async () => {
    (supplierStatementService.generateSupplierStatement as any).mockResolvedValue({ statementNo: "SS20240101001" });
    const req = mockReq({
      body: { supplierId: 1, startDate: "2024-01-01", endDate: "2024-01-31" },
    });
    const res = mockRes();
    await generateSupplierStatement(req as any, res as any);
    expect(supplierStatementService.generateSupplierStatement).toHaveBeenCalledWith({
      supplierId: 1,
      startDate: "2024-01-01",
      endDate: "2024-01-31",
      tenantId: "t1",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("listSupplierStatements - 应返回供应商对账单列表", async () => {
    (supplierStatementService.listSupplierStatements as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listSupplierStatements(req as any, res as any);
    expect(supplierStatementService.listSupplierStatements).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listSupplierStatements - 应支持筛选参数", async () => {
    (supplierStatementService.listSupplierStatements as any).mockResolvedValue({ total: 1, records: [] });
    const req = mockReq({
      query: {
        supplierId: 1,
        status: "CONFIRMED",
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        page: 2,
        pageSize: 10,
      },
    });
    const res = mockRes();
    await listSupplierStatements(req as any, res as any);
    expect(supplierStatementService.listSupplierStatements).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: 1,
        status: "CONFIRMED",
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        page: 2,
        pageSize: 10,
      })
    );
  });

  it("getSupplierStatementDetail - 应返回对账单详情", async () => {
    (supplierStatementService.getSupplierStatementDetail as any).mockResolvedValue({ statementNo: "SS20240101001" });
    const req = mockReq({ params: { statementNo: "SS20240101001" } });
    const res = mockRes();
    await getSupplierStatementDetail(req as any, res as any);
    expect(supplierStatementService.getSupplierStatementDetail).toHaveBeenCalledWith("SS20240101001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("confirmSupplierStatement - 应确认供应商对账单", async () => {
    (supplierStatementService.confirmSupplierStatement as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { statementNo: "SS20240101001" } });
    const res = mockRes();
    await confirmSupplierStatement(req as any, res as any);
    expect(supplierStatementService.confirmSupplierStatement).toHaveBeenCalledWith("SS20240101001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("disputeSupplierStatement - 应发起对账单异议", async () => {
    (supplierStatementService.disputeSupplierStatement as any).mockResolvedValue({ success: true });
    const req = mockReq({
      params: { statementNo: "SS20240101001" },
      body: { reason: "金额不符" },
    });
    const res = mockRes();
    await disputeSupplierStatement(req as any, res as any);
    expect(supplierStatementService.disputeSupplierStatement).toHaveBeenCalledWith("SS20240101001", "金额不符", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("disputeSupplierStatement - 缺少reason应正常调用", async () => {
    (supplierStatementService.disputeSupplierStatement as any).mockResolvedValue({ success: true });
    const req = mockReq({
      params: { statementNo: "SS20240101001" },
      body: {},
    });
    const res = mockRes();
    await disputeSupplierStatement(req as any, res as any);
    expect(supplierStatementService.disputeSupplierStatement).toHaveBeenCalledWith("SS20240101001", undefined, "t1");
  });
});