/**
 * 管理端费用管理 service 单元测试
 * 被测文件：src/services/admin/expense.service.ts
 * 覆盖全部 7 个导出函数，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db.js", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
}));

vi.mock("../../../shared/id.js", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  createExpense,
  listExpenses,
  getExpenseDetail,
  updateExpense,
  approveExpense,
  voidExpense,
  getExpenseSummary,
} from "../../../services/admin/expense.service.js";

beforeEach(() => {
  mocks.queryWithTenant.mockReset();
  mocks.queryOneWithTenant.mockReset();
  mocks.makeBizNo.mockReset();
  mocks.makeBizNo.mockReturnValue("FY20260709001");
});

// ============ createExpense ============
describe("admin expense.service - createExpense", () => {
  it("全部字段有值（?? 左分支）", async () => {
    const res = await createExpense({
      expenseType: "DAILY", category: "办公", amount: 1000,
      payee: "张三", paymentMethod: "CASH", bankAccountId: 1, invoiceNo: "INV001",
      expenseDate: "2026-07-09", remark: "备注", operatorId: 1, tenantId: "t1"
    });
    expect(res.expenseNo).toBe("FY20260709001");
    expect(res.status).toBe("PENDING");
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("可选字段为空（?? 右分支）", async () => {
    const res = await createExpense({
      amount: 500, tenantId: "t1"
    } as any);
    expect(res.expenseNo).toBe("FY20260709001");
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });
});

// ============ listExpenses ============
describe("admin expense.service - listExpenses", () => {
  it("有 expenseType + status + total 有值", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ expenseNo: "FY001", expenseType: "DAILY" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listExpenses({ expenseType: "DAILY", status: "PENDING", page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual({ total: 1, page: 1, pageSize: 10, records: [{ expenseNo: "FY001", expenseType: "DAILY" }] });
  });

  it("无 expenseType + 无 status + total null（?? 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listExpenses({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

// ============ getExpenseDetail ============
describe("admin expense.service - getExpenseDetail", () => {
  it("expense 存在时返回详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ expenseNo: "FY001", amount: 1000 });
    const res = await getExpenseDetail("FY001", "t1");
    expect(res.expenseNo).toBe("FY001");
  });

  it("expense 不存在时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getExpenseDetail("FY999", "t1")).rejects.toThrow("费用不存在");
  });
});

// ============ updateExpense ============
describe("admin expense.service - updateExpense", () => {
  it("更新全部字段（所有 !== undefined 左分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue({});
    const res = await updateExpense("FY001", {
      expenseType: "DAILY", category: "办公", amount: 2000, payee: "李四",
      paymentMethod: "BANK", expenseDate: "2026-07-09", remark: "更新备注", tenantId: "t1"
    });
    expect(res.expenseNo).toBe("FY001");
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });

  it("无字段更新时抛异常（fields.length === 0）", async () => {
    await expect(updateExpense("FY001", { tenantId: "t1" })).rejects.toThrow("没有需要更新的字段");
  });
});

// ============ approveExpense ============
describe("admin expense.service - approveExpense", () => {
  it("expense 不存在时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(approveExpense("FY999", "t1")).rejects.toThrow("费用不存在");
  });

  it("状态非 PENDING 时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ expenseNo: "FY001", status: "APPROVED" });
    await expect(approveExpense("FY001", "t1")).rejects.toThrow("只有待审批的费用可以审批");
  });

  it("成功审批", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ expenseNo: "FY001", status: "PENDING" });
    const res = await approveExpense("FY001", "t1");
    expect(res.status).toBe("APPROVED");
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });
});

// ============ voidExpense ============
describe("admin expense.service - voidExpense", () => {
  it("expense 不存在时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(voidExpense("FY999", "t1")).rejects.toThrow("费用不存在");
  });

  it("已作废时抛异常", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ expenseNo: "FY001", status: "VOIDED" });
    await expect(voidExpense("FY001", "t1")).rejects.toThrow("费用已作废");
  });

  it("成功作废", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ expenseNo: "FY001", status: "APPROVED" });
    const res = await voidExpense("FY001", "t1");
    expect(res.status).toBe("VOIDED");
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });
});

// ============ getExpenseSummary ============
describe("admin expense.service - getExpenseSummary", () => {
  it("有日期范围 + total 有值（?? 左分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ expenseType: "DAILY", totalAmount: 1000, cnt: 2 }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1000 });
    const res = await getExpenseSummary("t1", "2026-01-01", "2026-07-09");
    expect(res.totalAmount).toBe(1000);
    expect(res.byCategory).toEqual([{ expenseType: "DAILY", totalAmount: 1000, cnt: 2 }]);
  });

  it("无日期范围 + total null（?? 右分支）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await getExpenseSummary("t1");
    expect(res.totalAmount).toBe(0);
  });
});
