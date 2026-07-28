import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/expense.service", () => ({
  createExpense: vi.fn(),
  listExpenses: vi.fn(),
  getExpenseDetail: vi.fn(),
  updateExpense: vi.fn(),
  approveExpense: vi.fn(),
  voidExpense: vi.fn(),
  getExpenseSummary: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as expenseService from "../../../services/admin/expense.service";
import { ok } from "../../../shared/response";
import {
  createExpense,
  listExpenses,
  getExpenseDetail,
  updateExpense,
  approveExpense,
  voidExpense,
  getExpenseSummary,
} from "../../../controllers/admin/expense.controller";

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

describe("expense.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createExpense - 应创建费用单", async () => {
    (expenseService.createExpense as any).mockResolvedValue({ expenseNo: "E001" });
    const req = mockReq({
      body: {
        expenseType: "OFFICE", category: "办公", amount: 100, payee: "供应商",
        paymentMethod: "BANK", bankAccountId: 1, invoiceNo: "INV1", expenseDate: "2026-01-01", remark: "备注",
      },
    });
    const res = mockRes();
    await createExpense(req as any, res as any, vi.fn());
    expect(expenseService.createExpense).toHaveBeenCalledWith(expect.objectContaining({
      expenseType: "OFFICE", amount: 100, operatorId: 1, tenantId: "t1",
    }));
    expect(ok).toHaveBeenCalledWith({ expenseNo: "E001" });
  });

  it("createExpense - service抛出异常应被捕获", async () => {
    const error = new Error("创建失败");
    (expenseService.createExpense as any).mockRejectedValue(error);
    const req = mockReq({ body: { expenseType: "OFFICE", amount: 100 } });
    const res = mockRes();
    await expect(createExpense(req as any, res as any, vi.fn())).rejects.toThrow(error);
  });

  it("listExpenses - 应返回费用单列表", async () => {
    (expenseService.listExpenses as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listExpenses(req as any, res as any, vi.fn());
    expect(expenseService.listExpenses).toHaveBeenCalledWith(expect.objectContaining({
      page: 1, pageSize: 20, tenantId: "t1",
    }));
  });

  it("listExpenses - 应支持筛选条件", async () => {
    (expenseService.listExpenses as any).mockResolvedValue({ total: 1, records: [] });
    const req = mockReq({ query: { expenseType: "OFFICE", status: "PENDING", page: "2", pageSize: "10" } });
    const res = mockRes();
    await listExpenses(req as any, res as any, vi.fn());
    expect(expenseService.listExpenses).toHaveBeenCalledWith(expect.objectContaining({
      expenseType: "OFFICE", status: "PENDING", page: 2, pageSize: 10,
    }));
  });

  it("getExpenseDetail - 应返回费用单详情", async () => {
    (expenseService.getExpenseDetail as any).mockResolvedValue({ expenseNo: "E001" });
    const req = mockReq({ params: { expenseNo: "E001" } });
    const res = mockRes();
    await getExpenseDetail(req as any, res as any, vi.fn());
    expect(expenseService.getExpenseDetail).toHaveBeenCalledWith("E001", "t1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { expenseNo: "E001" } });
  });

  it("getExpenseDetail - 费用单不存在应抛出异常", async () => {
    const error = new Error("费用单不存在");
    (expenseService.getExpenseDetail as any).mockRejectedValue(error);
    const req = mockReq({ params: { expenseNo: "E999" } });
    const res = mockRes();
    await expect(getExpenseDetail(req as any, res as any, vi.fn())).rejects.toThrow(error);
  });

  it("updateExpense - 应更新费用单", async () => {
    (expenseService.updateExpense as any).mockResolvedValue({ success: true });
    const req = mockReq({
      params: { expenseNo: "E001" },
      body: { expenseType: "OFFICE", category: "办公", amount: 200, payee: "供应商B", paymentMethod: "CASH", expenseDate: "2026-02-01", remark: "改" },
    });
    const res = mockRes();
    await updateExpense(req as any, res as any, vi.fn());
    expect(expenseService.updateExpense).toHaveBeenCalledWith("E001", expect.objectContaining({
      amount: 200, tenantId: "t1",
    }));
  });

  it("approveExpense - 应审批费用单", async () => {
    (expenseService.approveExpense as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { expenseNo: "E001" } });
    const res = mockRes();
    await approveExpense(req as any, res as any, vi.fn());
    expect(expenseService.approveExpense).toHaveBeenCalledWith("E001", "t1");
    expect(ok).toHaveBeenCalledWith({ success: true });
  });

  it("voidExpense - 应作废费用单", async () => {
    (expenseService.voidExpense as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { expenseNo: "E002" } });
    const res = mockRes();
    await voidExpense(req as any, res as any, vi.fn());
    expect(expenseService.voidExpense).toHaveBeenCalledWith("E002", "t1");
  });

  it("getExpenseSummary - 应返回费用汇总", async () => {
    (expenseService.getExpenseSummary as any).mockResolvedValue({ total: 500 });
    const req = mockReq({ query: { startDate: "2026-01-01", endDate: "2026-01-31" } });
    const res = mockRes();
    await getExpenseSummary(req as any, res as any, vi.fn());
    expect(expenseService.getExpenseSummary).toHaveBeenCalledWith("t1", "2026-01-01", "2026-01-31");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { total: 500 } });
  });

  it("getExpenseSummary - 不传日期时为undefined", async () => {
    (expenseService.getExpenseSummary as any).mockResolvedValue({});
    const req = mockReq();
    const res = mockRes();
    await getExpenseSummary(req as any, res as any, vi.fn());
    expect(expenseService.getExpenseSummary).toHaveBeenCalledWith("t1", undefined, undefined);
  });

  it("approveExpense - 审批失败应抛出异常", async () => {
    const error = new Error("审批失败");
    (expenseService.approveExpense as any).mockRejectedValue(error);
    const req = mockReq({ params: { expenseNo: "E001" } });
    const res = mockRes();
    await expect(approveExpense(req as any, res as any, vi.fn())).rejects.toThrow(error);
  });

  it("listExpenses - 不传page和pageSize时使用默认值1和20", async () => {
    (expenseService.listExpenses as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listExpenses(req as any, res as any, vi.fn());
    expect(expenseService.listExpenses).toHaveBeenCalledWith(expect.objectContaining({
      page: 1, pageSize: 20, tenantId: "t1",
    }));
  });

  it("updateExpense - 不传remark时应为undefined", async () => {
    (expenseService.updateExpense as any).mockResolvedValue({ success: true });
    const req = mockReq({
      params: { expenseNo: "E001" },
      body: { expenseType: "OFFICE", category: "办公", amount: 200, payee: "B", paymentMethod: "CASH", expenseDate: "2026-02-01" },
    });
    const res = mockRes();
    await updateExpense(req as any, res as any, vi.fn());
    expect(expenseService.updateExpense).toHaveBeenCalledWith("E001", expect.objectContaining({
      remark: undefined, tenantId: "t1",
    }));
  });
});