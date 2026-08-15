import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import { list, getDetail, voidPayment } from "../../../services/admin/customer-payment.service";

describe("admin/customer-payment.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.makeBizNo.mockReturnValue("SK20260815001");
  });

  it("list：分页收款单列表", async () => {
    mocks.query.mockResolvedValueOnce([{ receipt_no: "SK001", amount: 100 }]);
    const result = await list({ page: 1, pageSize: 20, tenantId: "t1" });
    expect(result).toHaveLength(1);
    expect(result[0].receipt_no).toBe("SK001");
  });

  it("getDetail：返回收款单详情", async () => {
    mocks.queryOne.mockResolvedValueOnce({ receiptNo: "SK001", amount: 100, status: "ACTIVE" });
    const detail = await getDetail("SK001", "t1");
    expect(detail?.receiptNo).toBe("SK001");
  });

  it("voidPayment：作废收款单", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1, status: "COMPLETED", source_type: "SALE_BILL", source_no: "XS001", amount: 100 });
    const conn = { query: vi.fn() };
    conn.query
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE t_customer_payment
      .mockResolvedValueOnce([[{ receivable_amount: 200, received_amount: 100 }]]) // 销售单查询
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE t_sale_bill
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));
    const result = await voidPayment("SK001", "t1", 1, "管理员");
    expect(result).not.toBeNull();
    expect(conn.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_customer_payment"),
      expect.arrayContaining(["SK001", "t1"])
    );
  });
});
