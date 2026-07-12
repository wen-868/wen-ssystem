import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/customer-statement.service", () => ({
  list: vi.fn(),
  getDetail: vi.fn(),
  create: vi.fn(),
  confirm: vi.fn(),
  markPaid: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as customerStatementService from "@services/admin/customer-statement.service";
import { ok } from "@shared/response";
import { list, getDetail, create, confirm, markPaid } from "@controllers/customer-statement.controller";

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

describe("customer-statement.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list - 应返回客户对账单列表", async () => {
    (customerStatementService.list as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await list(req as any, res as any);
    expect(customerStatementService.list).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getDetail - 应返回对账单详情", async () => {
    (customerStatementService.getDetail as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { statementNo: "STMT001" } });
    const res = mockRes();
    await getDetail(req as any, res as any);
    expect(customerStatementService.getDetail).toHaveBeenCalledWith("STMT001", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("create - 应创建对账单", async () => {
    (customerStatementService.create as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { customerId: 1, startDate: "2024-01-01" } });
    const res = mockRes();
    await create(req as any, res as any);
    expect(customerStatementService.create).toHaveBeenCalledWith(req.body, "t1", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });

  it("confirm - 应确认对账单", async () => {
    (customerStatementService.confirm as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { statementNo: "STMT001" } });
    const res = mockRes();
    await confirm(req as any, res as any);
    expect(customerStatementService.confirm).toHaveBeenCalledWith("STMT001", "t1", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });

  it("markPaid - 应标记已付款", async () => {
    (customerStatementService.markPaid as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { statementNo: "STMT001" } });
    const res = mockRes();
    await markPaid(req as any, res as any);
    expect(customerStatementService.markPaid).toHaveBeenCalledWith("STMT001", "t1", 1, "admin");
    expect(ok).toHaveBeenCalled();
  });
});