/**
 * 管理端费用管理 controller 单元测试
 * 被测文件：src/controllers/admin/expense.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  createExpense: vi.fn(),
  listExpenses: vi.fn(),
  getExpenseDetail: vi.fn(),
  updateExpense: vi.fn(),
  approveExpense: vi.fn(),
  voidExpense: vi.fn(),
  getExpenseSummary: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/expense.service.js", () => ({
  createExpense: mocks.createExpense,
  listExpenses: mocks.listExpenses,
  getExpenseDetail: mocks.getExpenseDetail,
  updateExpense: mocks.updateExpense,
  approveExpense: mocks.approveExpense,
  voidExpense: mocks.voidExpense,
  getExpenseSummary: mocks.getExpenseSummary,
}));

import {
  createExpense,
  listExpenses,
  getExpenseDetail,
  updateExpense,
  approveExpense,
  voidExpense,
  getExpenseSummary,
} from "../../../controllers/admin/expense.controller.js";

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

describe("admin expense.controller", () => {
  it("createExpense 成功创建并传递 operatorId 和 tenantId", async () => {
    mocks.createExpense.mockResolvedValue({ expenseNo: "E001" });
    const req = mockReq({
      body: {
        expenseType: "OFFICE", category: "办公", amount: 100, payee: "供应商",
        paymentMethod: "BANK", bankAccountId: 1, invoiceNo: "INV1", expenseDate: "2026-01-01", remark: "备注",
      },
    });
    const res = mockRes();
    await createExpense(req, res);
    expect(mocks.createExpense).toHaveBeenCalledWith(expect.objectContaining({
      expenseType: "OFFICE", amount: 100, operatorId: 1, tenantId: "t1",
    }));
    expect(mocks.ok).toHaveBeenCalledWith({ expenseNo: "E001" });
  });

  it("listExpenses 默认分页参数", async () => {
    mocks.listExpenses.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listExpenses(req, res);
    expect(mocks.listExpenses).toHaveBeenCalledWith(expect.objectContaining({
      page: 1, pageSize: 20, tenantId: "t1",
    }));
  });

  it("listExpenses 传入筛选条件", async () => {
    mocks.listExpenses.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq({ query: { expenseType: "OFFICE", status: "PENDING", page: "2", pageSize: "10" } });
    const res = mockRes();
    await listExpenses(req, res);
    expect(mocks.listExpenses).toHaveBeenCalledWith(expect.objectContaining({
      expenseType: "OFFICE", status: "PENDING", page: 2, pageSize: 10,
    }));
  });

  it("getExpenseDetail 传入 expenseNo", async () => {
    mocks.getExpenseDetail.mockResolvedValue({ expenseNo: "E001" });
    const req = mockReq({ params: { expenseNo: "E001" } });
    const res = mockRes();
    await getExpenseDetail(req, res);
    expect(mocks.getExpenseDetail).toHaveBeenCalledWith("E001", "t1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { expenseNo: "E001" } });
  });

  it("updateExpense 传入参数", async () => {
    mocks.updateExpense.mockResolvedValue({ success: true });
    const req = mockReq({
      params: { expenseNo: "E001" },
      body: { expenseType: "OFFICE", category: "办公", amount: 200, payee: "供应商B", paymentMethod: "CASH", expenseDate: "2026-02-01", remark: "改" },
    });
    const res = mockRes();
    await updateExpense(req, res);
    expect(mocks.updateExpense).toHaveBeenCalledWith("E001", expect.objectContaining({
      amount: 200, tenantId: "t1",
    }));
  });

  it("approveExpense 传入 expenseNo", async () => {
    mocks.approveExpense.mockResolvedValue({ success: true });
    const req = mockReq({ params: { expenseNo: "E001" } });
    const res = mockRes();
    await approveExpense(req, res);
    expect(mocks.approveExpense).toHaveBeenCalledWith("E001", "t1");
    expect(mocks.ok).toHaveBeenCalledWith({ success: true });
  });

  it("voidExpense 传入 expenseNo", async () => {
    mocks.voidExpense.mockResolvedValue({ success: true });
    const req = mockReq({ params: { expenseNo: "E002" } });
    const res = mockRes();
    await voidExpense(req, res);
    expect(mocks.voidExpense).toHaveBeenCalledWith("E002", "t1");
  });

  it("getExpenseSummary 传入日期范围", async () => {
    mocks.getExpenseSummary.mockResolvedValue({ total: 500 });
    const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-01-31" } });
    const res = mockRes();
    await getExpenseSummary(req, res);
    expect(mocks.getExpenseSummary).toHaveBeenCalledWith("t1", "2026-01-01", "2026-01-31");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { total: 500 } });
  });

  it("getExpenseSummary 不传日期时为 undefined", async () => {
    mocks.getExpenseSummary.mockResolvedValue({});
    const req = mockReq();
    const res = mockRes();
    await getExpenseSummary(req, res);
    expect(mocks.getExpenseSummary).toHaveBeenCalledWith("t1", undefined, undefined);
  });
});
