/**
 * 采购付款 service 单元测试
 * 被测文件：src/services/admin/purchase-payment.service.ts
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

vi.mock("../../../shared/db.js", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id.js", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import {
  list,
  getDetail,
  create,
  approve,
  voidPayment,
} from "../../../services/admin/purchase-payment.service.js";

const mockConn = { query: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("FK20260709000001");
  mocks.transaction.mockImplementation(async (cb: any) => cb(mockConn));
});

describe("purchase-payment.service - list", () => {
  it("无可选筛选条件（conditions.length === 0，whereClause 为空）", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ payment_no: "FK1" }]);
    const res = await list({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res).toEqual([{ payment_no: "FK1" }]);
  });

  it("传入全部筛选条件（每个 if 均走 true 分支，conditions.length > 0）", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    await list({
      page: 1, pageSize: 10, tenantId: "t1",
      supplierId: 1, paymentType: "ORDER", status: "PENDING",
      dateStart: "2026-01-01", dateEnd: "2026-12-31",
    });
    expect(mocks.queryWithTenant).toHaveBeenCalledOnce();
  });
});

describe("purchase-payment.service - getDetail", () => {
  it("付款单存在时返回详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ payment_no: "FK1", amount: 100 });
    const res = await getDetail("FK1", "t1");
    expect(res.payment_no).toBe("FK1");
  });

  it("付款单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(getDetail("FK1", "t1")).rejects.toMatchObject({
      message: "付款单不存在",
      statusCode: 404,
    });
  });
});

describe("purchase-payment.service - create", () => {
  it("全部可选字段有值（覆盖所有 || 左分支）", async () => {
    mockConn.query.mockResolvedValue([]);
    const res = await create({
      supplier_id: 1, supplier_name: "供应商A",
      payment_type: "DIRECT", source_type: "PURCHASE_ORDER", source_no: "CG001",
      amount: 500, payment_method: "CASH",
      bank_account: "6228", bank_account_name: "张三", bank_name: "农行",
      voucher_no: "V001", payment_date: "2026-07-09", remark: "备注",
    }, "t1", 1, "admin");
    expect(res).toEqual({ payment_no: "FK20260709000001" });
    expect(mockConn.query).toHaveBeenCalledTimes(2);
  });

  it("全部可选字段缺失（覆盖所有 || 右分支）", async () => {
    mockConn.query.mockResolvedValue([]);
    const res = await create({
      supplier_id: 2, supplier_name: "供应商B",
      amount: 300, payment_date: "2026-07-09",
    } as any, "t1", 2, "user");
    expect(res).toEqual({ payment_no: "FK20260709000001" });
  });
});

describe("purchase-payment.service - approve", () => {
  it("付款单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(approve("FK1", "t1", 1, "admin")).rejects.toMatchObject({
      message: "付款单不存在", statusCode: 404,
    });
  });

  it("状态非 PENDING 时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "COMPLETED", source_type: null, source_no: null, amount: 100 });
    await expect(approve("FK1", "t1", 1, "admin")).rejects.toMatchObject({
      message: "只有待审核状态的付款单可以审核", statusCode: 400,
    });
  });

  it("source_type=PURCHASE_ORDER 且 source_no 有值，orderRow 存在（&& 全 true + orderRow true）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      id: 1, status: "PENDING", source_type: "PURCHASE_ORDER", source_no: "CG001", amount: 200,
    });
    mockConn.query.mockResolvedValue([]);
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("SELECT payable_amount")) {
        return Promise.resolve([[{ payable_amount: 1000, paid_amount: 300 }], undefined]);
      }
      return Promise.resolve([]);
    });
    const res = await approve("FK1", "t1", 1, "admin");
    expect(res).toEqual({ payment_no: "FK1" });
  });

  it("source_type=PURCHASE_ORDER 且 source_no 有值，orderRow 不存在（&& 全 true + orderRow false）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      id: 1, status: "PENDING", source_type: "PURCHASE_ORDER", source_no: "CG002", amount: 200,
    });
    mockConn.query.mockImplementation((sql: string) => {
      if (sql.includes("SELECT payable_amount")) {
        return Promise.resolve([[], undefined]);
      }
      return Promise.resolve([]);
    });
    const res = await approve("FK2", "t1", 1, "admin");
    expect(res).toEqual({ payment_no: "FK2" });
  });

  it("source_type=PURCHASE_ORDER 但 source_no 为空（&& 右 false 分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      id: 1, status: "PENDING", source_type: "PURCHASE_ORDER", source_no: null, amount: 100,
    });
    mockConn.query.mockResolvedValue([]);
    const res = await approve("FK3", "t1", 1, "admin");
    expect(res).toEqual({ payment_no: "FK3" });
  });

  it("source_type 非 PURCHASE_ORDER（&& 左 false 分支）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({
      id: 1, status: "PENDING", source_type: "DIRECT", source_no: null, amount: 100,
    });
    mockConn.query.mockResolvedValue([]);
    const res = await approve("FK4", "t1", 1, "admin");
    expect(res).toEqual({ payment_no: "FK4" });
  });
});

describe("purchase-payment.service - voidPayment", () => {
  it("付款单不存在时抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(voidPayment("FK1", "t1", 1, "admin")).rejects.toMatchObject({
      message: "付款单不存在", statusCode: 404,
    });
  });

  it("状态非 PENDING 时抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "COMPLETED" });
    await expect(voidPayment("FK1", "t1", 1, "admin")).rejects.toMatchObject({
      message: "只有待审核状态的付款单可以作废", statusCode: 400,
    });
  });

  it("成功作废（状态 PENDING）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING" });
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await voidPayment("FK1", "t1", 1, "admin");
    expect(res).toEqual({ payment_no: "FK1" });
    expect(mocks.queryWithTenant).toHaveBeenCalledTimes(2);
  });
});
