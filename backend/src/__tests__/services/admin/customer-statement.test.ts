/**
 * 管理端客户对账单 service 单元测试
 * 被测文件：src/services/admin/customer-statement.service.ts
 * 覆盖全部 5 个导出函数，目标覆盖率 100%
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  list,
  getDetail,
  create,
  confirm,
  markPaid,
} from "../../../services/admin/customer-statement.service";

const mockConn = { query: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("DZ20260709000001");
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

// ============ list ============
describe("admin customer-statement.service - list", () => {
  it("全部筛选条件有值", async () => {
    mocks.query.mockResolvedValue([{ id: 1, statement_no: "DZ001" }]);
    const res = await list({ page: 1, pageSize: 10, tenantId: "t1", customerId: 1, status: "DRAFT", dateStart: "2026-01-01", dateEnd: "2026-12-31" });
    expect(res).toEqual([{ id: 1, statement_no: "DZ001" }]);
  });

  it("无筛选条件", async () => {
    mocks.query.mockResolvedValue([]);
    const res = await list({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual([]);
  });
});

// ============ getDetail ============
describe("admin customer-statement.service - getDetail", () => {
  it("对账单不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(getDetail("DZ999", "t1")).rejects.toMatchObject({ statusCode: 404, message: "对账单不存在" });
  });

  it("对账单存在时返回详情含明细", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, statement_no: "DZ001", customer_id: 1, start_date: "2026-01-01", end_date: "2026-12-31" });
    mocks.query
      .mockResolvedValueOnce([{ bill_no: "B001", customer_name: "张三", receivable_amount: 100 }])  // sales
      .mockResolvedValueOnce([{ return_no: "R001", refund_amount: 10 }])  // returns
      .mockResolvedValueOnce([{ receipt_no: "SK001", amount: 50, payment_date: "2026-06-01" }]);  // payments
    const res = await getDetail("DZ001", "t1");
    expect(res.statement_no).toBe("DZ001");
    expect(res.sales).toHaveLength(1);
    expect(res.returns).toHaveLength(1);
    expect(res.payments).toHaveLength(1);
  });
});

// ============ create ============
describe("admin customer-statement.service - create", () => {
  it("成功创建（全部金额有值，|| 左分支 + ?. 左分支）", async () => {
    mockConn.query
      .mockResolvedValueOnce([[{ opening_balance: 100 }]])   // openingRows
      .mockResolvedValueOnce([[{ total_sales: 500 }]])        // salesRows
      .mockResolvedValueOnce([[{ total_returns: 50 }]])       // returnsRows
      .mockResolvedValueOnce([[{ total_payments: 200 }]])     // paymentsRows
      .mockResolvedValueOnce([{}])                             // INSERT statement
      .mockResolvedValueOnce([{}]);                            // INSERT log
    const res = await create({
      customer_id: 1, customer_name: "张三", customer_mobile: "138",
      statement_type: "MONTHLY", start_date: "2026-01-01", end_date: "2026-12-31", remark: "备注",
    }, "t1", 1, "user1");
    expect(res).toEqual({ statement_no: "DZ20260709000001" });
  });

  it("成功创建（全部金额为空数组，|| 右分支 + ?. 第二层右分支）", async () => {
    mockConn.query
      .mockResolvedValueOnce([[]])   // openingRows = []
      .mockResolvedValueOnce([[]])   // salesRows = []
      .mockResolvedValueOnce([[]])   // returnsRows = []
      .mockResolvedValueOnce([[]])   // paymentsRows = []
      .mockResolvedValueOnce([{}])   // INSERT statement
      .mockResolvedValueOnce([{}]);  // INSERT log
    const res = await create({
      customer_id: 1, customer_name: "张三", start_date: "2026-01-01", end_date: "2026-12-31",
    }, "t1", 1, "user1");
    expect(res).toEqual({ statement_no: "DZ20260709000001" });
  });

  it("成功创建（rows 为 null，?. 第一层右分支）", async () => {
    mockConn.query
      .mockResolvedValueOnce([null])   // openingRows = null
      .mockResolvedValueOnce([null])   // salesRows = null
      .mockResolvedValueOnce([null])   // returnsRows = null
      .mockResolvedValueOnce([null])   // paymentsRows = null
      .mockResolvedValueOnce([{}])     // INSERT statement
      .mockResolvedValueOnce([{}]);    // INSERT log
    const res = await create({
      customer_id: 1, customer_name: "张三", start_date: "2026-01-01", end_date: "2026-12-31",
    }, "t1", 1, "user1");
    expect(res).toEqual({ statement_no: "DZ20260709000001" });
  });
});

// ============ confirm ============
describe("admin customer-statement.service - confirm", () => {
  it("对账单不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(confirm("DZ999", "t1", 1, "user1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("状态非 DRAFT 时抛 400", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, status: "CONFIRMED" });
    await expect(confirm("DZ001", "t1", 1, "user1")).rejects.toMatchObject({ statusCode: 400, message: "只有草稿状态的对账单可以确认" });
  });

  it("成功确认", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, status: "DRAFT" });
    const res = await confirm("DZ001", "t1", 1, "user1");
    expect(res).toEqual({ statement_no: "DZ001" });
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });
});

// ============ markPaid ============
describe("admin customer-statement.service - markPaid", () => {
  it("对账单不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(markPaid("DZ999", "t1", 1, "user1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("状态非 CONFIRMED 时抛 400", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, status: "DRAFT" });
    await expect(markPaid("DZ001", "t1", 1, "user1")).rejects.toMatchObject({ statusCode: 400, message: "只有已确认状态的对账单可以标记结清" });
  });

  it("成功标记结清", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, status: "CONFIRMED" });
    const res = await markPaid("DZ001", "t1", 1, "user1");
    expect(res).toEqual({ statement_no: "DZ001" });
  });
});
