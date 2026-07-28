/**
 * 供应商对账单 controller 单元测试
 * 被测文件：src/controllers/admin/supplier-statement.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
  user: { id: 1 },
  headers: {},
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

describe("admin/supplier-statement.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("generateSupplierStatement", () => {
    it("生成供应商对账单", async () => {
      (supplierStatementService.generateSupplierStatement as any).mockResolvedValue({ statementNo: "DZD20260101" });
      const req = mockReq({
        body: { supplierId: 1, startDate: "2026-01-01", endDate: "2026-01-31" },
      });
      const res = mockRes();
      await generateSupplierStatement(req as any, res as any, vi.fn());
      expect(supplierStatementService.generateSupplierStatement).toHaveBeenCalledWith(expect.objectContaining({
        supplierId: 1,
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        tenantId: "t1",
      }));
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("listSupplierStatements", () => {
    it("带 supplierId 查询", async () => {
      (supplierStatementService.listSupplierStatements as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({
        query: { supplierId: "1", status: "PENDING" },
      });
      const res = mockRes();
      await listSupplierStatements(req as any, res as any, vi.fn());
      expect(supplierStatementService.listSupplierStatements).toHaveBeenCalledWith(expect.objectContaining({
        supplierId: 1,
        status: "PENDING",
      }));
      expect(ok).toHaveBeenCalled();
    });

    it("不带 supplierId 查询", async () => {
      (supplierStatementService.listSupplierStatements as any).mockResolvedValue({ total: 5, records: [] });
      const req = mockReq({ query: { page: "1", pageSize: "10" } });
      const res = mockRes();
      await listSupplierStatements(req as any, res as any, vi.fn());
      expect(supplierStatementService.listSupplierStatements).toHaveBeenCalledWith(expect.objectContaining({
        supplierId: undefined,
        page: 1,
        pageSize: 10,
      }));
    });
  });

  describe("getSupplierStatementDetail", () => {
    it("获取对账单详情", async () => {
      (supplierStatementService.getSupplierStatementDetail as any).mockResolvedValue({ statementNo: "DZD001" });
      const req = mockReq({ params: { statementNo: "DZD001" } });
      const res = mockRes();
      await getSupplierStatementDetail(req as any, res as any, vi.fn());
      expect(supplierStatementService.getSupplierStatementDetail).toHaveBeenCalledWith("DZD001", "t1");
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("confirmSupplierStatement", () => {
    it("确认对账单", async () => {
      (supplierStatementService.confirmSupplierStatement as any).mockResolvedValue({ statementNo: "DZD001", status: "CONFIRMED" });
      const req = mockReq({ params: { statementNo: "DZD001" } });
      const res = mockRes();
      await confirmSupplierStatement(req as any, res as any, vi.fn());
      expect(supplierStatementService.confirmSupplierStatement).toHaveBeenCalledWith("DZD001", "t1");
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("disputeSupplierStatement", () => {
    it("提出异议", async () => {
      (supplierStatementService.disputeSupplierStatement as any).mockResolvedValue({ statementNo: "DZD001", status: "DISPUTED" });
      const req = mockReq({
        params: { statementNo: "DZD001" },
        body: { reason: "数量不对" },
      });
      const res = mockRes();
      await disputeSupplierStatement(req as any, res as any, vi.fn());
      expect(supplierStatementService.disputeSupplierStatement).toHaveBeenCalledWith("DZD001", "数量不对", "t1");
      expect(ok).toHaveBeenCalled();
    });
  });
});
