import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  generateSupplierStatement: vi.fn(),
  listSupplierStatements: vi.fn(),
  getSupplierStatementDetail: vi.fn(),
  confirmSupplierStatement: vi.fn(),
  disputeSupplierStatement: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/supplier-statement.service.js", () => ({
  generateSupplierStatement: mocks.generateSupplierStatement,
  listSupplierStatements: mocks.listSupplierStatements,
  getSupplierStatementDetail: mocks.getSupplierStatementDetail,
  confirmSupplierStatement: mocks.confirmSupplierStatement,
  disputeSupplierStatement: mocks.disputeSupplierStatement,
}));

import {
  generateSupplierStatement,
  listSupplierStatements,
  getSupplierStatementDetail,
  confirmSupplierStatement,
  disputeSupplierStatement,
} from "../../../controllers/admin/supplier-statement.controller.js";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin supplier-statement.controller", () => {
  it("generateSupplierStatement - 应生成供应商对账单", async () => {
    const body = { supplierId: 1, startDate: "2026-07-01", endDate: "2026-07-31" };
    mocks.generateSupplierStatement.mockResolvedValue({ statementNo: "SS001" });
    const req = mockReq({ body });
    const res = mockRes();
    await generateSupplierStatement(req, res);
    expect(mocks.generateSupplierStatement).toHaveBeenCalledWith(
      expect.objectContaining({ supplierId: 1, startDate: "2026-07-01", endDate: "2026-07-31", tenantId: "t1" })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("listSupplierStatements - 应返回供应商对账单列表", async () => {
    mocks.listSupplierStatements.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({
      query: {
        supplierId: "1",
        status: "PENDING",
        startDate: "2026-07-01",
        endDate: "2026-07-31",
        page: "1",
        pageSize: "10",
      },
    });
    const res = mockRes();
    await listSupplierStatements(req, res);
    expect(mocks.listSupplierStatements).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: 1,
        status: "PENDING",
        startDate: "2026-07-01",
        endDate: "2026-07-31",
        page: 1,
        pageSize: 10,
        tenantId: "t1",
      })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("listSupplierStatements - 使用默认分页参数，可选参数不传", async () => {
    mocks.listSupplierStatements.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listSupplierStatements(req, res);
    expect(mocks.listSupplierStatements).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20, tenantId: "t1" })
    );
  });

  it("getSupplierStatementDetail - 应返回对账单详情", async () => {
    mocks.getSupplierStatementDetail.mockResolvedValue({ statementNo: "SS001" });
    const req = mockReq({ params: { statementNo: "SS001" } });
    const res = mockRes();
    await getSupplierStatementDetail(req, res);
    expect(mocks.getSupplierStatementDetail).toHaveBeenCalledWith("SS001", "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("confirmSupplierStatement - 应确认对账单", async () => {
    mocks.confirmSupplierStatement.mockResolvedValue({ statementNo: "SS001" });
    const req = mockReq({ params: { statementNo: "SS001" } });
    const res = mockRes();
    await confirmSupplierStatement(req, res);
    expect(mocks.confirmSupplierStatement).toHaveBeenCalledWith("SS001", "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("disputeSupplierStatement - 应对账提出异议", async () => {
    const body = { reason: "金额不符" };
    mocks.disputeSupplierStatement.mockResolvedValue({ statementNo: "SS001" });
    const req = mockReq({ params: { statementNo: "SS001" }, body });
    const res = mockRes();
    await disputeSupplierStatement(req, res);
    expect(mocks.disputeSupplierStatement).toHaveBeenCalledWith("SS001", "金额不符", "t1");
    expect(res.json).toHaveBeenCalled();
  });
});
