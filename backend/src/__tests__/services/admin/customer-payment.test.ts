/**
 * 管理端客户收款 service 单元测试
 * 被测文件：src/services/admin/customer-payment.service.ts
 * 覆盖全部 4 个导出函数，目标覆盖率 100%
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
  voidPayment,
} from "../../../services/admin/customer-payment.service";

const mockConn = { query: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("SK20260709000001");
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

// ============ list ============
describe("admin customer-payment.service - list", () => {
  it("全部筛选条件有值", async () => {
    mocks.query.mockResolvedValue([{ id: 1, receipt_no: "SK001" }]);
    const res = await list({ page: 1, pageSize: 10, tenantId: "t1", customerId: 1, status: "COMPLETED", dateStart: "2026-01-01", dateEnd: "2026-12-31" });
    expect(res).toEqual([{ id: 1, receipt_no: "SK001" }]);
  });

  it("无筛选条件", async () => {
    mocks.query.mockResolvedValue([]);
    const res = await list({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual([]);
  });
});

// ============ getDetail ============
describe("admin customer-payment.service - getDetail", () => {
  it("收款单不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(getDetail("SK999", "t1")).rejects.toMatchObject({ statusCode: 404, message: "收款单不存在" });
  });

  it("收款单存在时返回详情", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, receipt_no: "SK001", amount: 100 });
    const res = await getDetail("SK001", "t1");
    expect(res).toEqual({ id: 1, receipt_no: "SK001", amount: 100 });
  });
});

// ============ create ============
describe("admin customer-payment.service - create", () => {
  it("非 SALE_BILL 类型（|| 全右分支 + 不更新销售单）", async () => {
    mockConn.query.mockResolvedValue([{}]);  // INSERT payment + INSERT log
    const res = await create({
      customer_id: 1, customer_name: "张三", amount: 100, payment_date: "2026-07-09",
    }, "t1", 1, "user1");
    expect(res).toEqual({ receipt_no: "SK20260709000001" });
    expect(mockConn.query).toHaveBeenCalledTimes(2);  // INSERT payment + INSERT log
  });

  it("SALE_BILL 类型 + 全字段有值（|| 全左分支）+ 部分付款（PARTIAL）", async () => {
    mockConn.query
      .mockResolvedValueOnce([{}])                                          // INSERT payment
      .mockResolvedValueOnce([[{ receivable_amount: 1000, received_amount: 0 }]])  // SELECT bill
      .mockResolvedValueOnce([{}])                                          // UPDATE t_bill
      .mockResolvedValueOnce([{}]);                                         // INSERT log
    const res = await create({
      customer_id: 1, customer_name: "张三", amount: 200, payment_date: "2026-07-09",
      payment_method: "WECHAT", source_type: "SALE_BILL", source_no: "B001",
      voucher_no: "V001", remark: "备注",
    }, "t1", 1, "user1");
    expect(res).toEqual({ receipt_no: "SK20260709000001" });
  });

  it("SALE_BILL 类型 + 完全付清（PAID）", async () => {
    mockConn.query
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ receivable_amount: 100, received_amount: 0 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);
    const res = await create({
      customer_id: 1, customer_name: "张三", amount: 100, payment_date: "2026-07-09",
      source_type: "SALE_BILL", source_no: "B002",
    }, "t1", 1, "user1");
    expect(res).toEqual({ receipt_no: "SK20260709000001" });
  });

  it("SALE_BILL 类型 + 销售单不存在（billRow 为 undefined）", async () => {
    mockConn.query
      .mockResolvedValueOnce([{}])   // INSERT payment
      .mockResolvedValueOnce([[]])   // SELECT bill (空)
      .mockResolvedValueOnce([{}]);  // INSERT log
    const res = await create({
      customer_id: 1, customer_name: "张三", amount: 100, payment_date: "2026-07-09",
      source_type: "SALE_BILL", source_no: "B999",
    }, "t1", 1, "user1");
    expect(res).toEqual({ receipt_no: "SK20260709000001" });
  });
});

// ============ voidPayment ============
describe("admin customer-payment.service - voidPayment", () => {
  it("收款单不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValue(null);
    await expect(voidPayment("SK999", "t1", 1, "user1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("状态非 COMPLETED 时抛 400", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, status: "VOIDED", source_type: null, source_no: null, amount: 100 });
    await expect(voidPayment("SK001", "t1", 1, "user1")).rejects.toMatchObject({ statusCode: 400, message: "只有已完成状态的收款单可以作废" });
  });

  it("非 SALE_BILL 类型（不更新销售单）", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, status: "COMPLETED", source_type: null, source_no: null, amount: 100 });
    mockConn.query.mockResolvedValue([{}]);
    const res = await voidPayment("SK001", "t1", 1, "user1");
    expect(res).toEqual({ receipt_no: "SK001" });
    expect(mockConn.query).toHaveBeenCalledTimes(2);  // UPDATE t_payment + INSERT log
  });

  it("SALE_BILL 类型 + billRow 不存在", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, status: "COMPLETED", source_type: "SALE_BILL", source_no: "B001", amount: 100 });
    mockConn.query
      .mockResolvedValueOnce([{}])   // UPDATE t_payment
      .mockResolvedValueOnce([[]])   // SELECT bill (空)
      .mockResolvedValueOnce([{}]);  // INSERT log
    const res = await voidPayment("SK001", "t1", 1, "user1");
    expect(res).toEqual({ receipt_no: "SK001" });
  });

  it("SALE_BILL 类型 + 部分付款（PARTIAL）", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, status: "COMPLETED", source_type: "SALE_BILL", source_no: "B001", amount: 200 });
    mockConn.query
      .mockResolvedValueOnce([{}])   // UPDATE t_payment
      .mockResolvedValueOnce([[{ receivable_amount: 1000, received_amount: 500 }]])  // SELECT bill
      .mockResolvedValueOnce([{}])   // UPDATE t_bill
      .mockResolvedValueOnce([{}]);  // INSERT log
    const res = await voidPayment("SK001", "t1", 1, "user1");
    expect(res).toEqual({ receipt_no: "SK001" });
  });

  it("SALE_BILL 类型 + 完全付清（PAID）", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, status: "COMPLETED", source_type: "SALE_BILL", source_no: "B002", amount: 100 });
    mockConn.query
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ receivable_amount: 500, received_amount: 600 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);
    const res = await voidPayment("SK002", "t1", 1, "user1");
    expect(res).toEqual({ receipt_no: "SK002" });
  });

  it("SALE_BILL 类型 + 未付款（UNPAID）", async () => {
    mocks.queryOne.mockResolvedValue({ id: 1, status: "COMPLETED", source_type: "SALE_BILL", source_no: "B003", amount: 100 });
    mockConn.query
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ receivable_amount: 500, received_amount: 100 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);
    const res = await voidPayment("SK003", "t1", 1, "user1");
    expect(res).toEqual({ receipt_no: "SK003" });
  });
});
