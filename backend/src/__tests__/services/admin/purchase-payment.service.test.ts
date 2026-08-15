import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

import { list, getDetail, approve } from "../../../services/admin/purchase-payment.service";

describe("admin/purchase-payment.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("list：分页付款单列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ payment_no: "FK001", amount: 100 }]);
    const result = await list({ page: 1, pageSize: 20, tenantId: "t1" });
    expect(result).toHaveLength(1);
    expect(result[0].payment_no).toBe("FK001");
  });

  it("getDetail：返回付款单详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ payment_no: "FK001", amount: 100, status: "PENDING" });
    const detail = await getDetail("FK001", "t1");
    expect(detail?.payment_no).toBe("FK001");
  });

  it("approve：审核通过并回写采购单已付金额", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 1, status: "PENDING", source_type: "PURCHASE_ORDER", source_no: "CG001", amount: 100,
    });
    const conn = { query: vi.fn() };
    conn.query
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE 付款单
      .mockResolvedValueOnce([[{ payable_amount: 500, paid_amount: 300 }]]) // 采购单查询
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE 采购单
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // INSERT 操作日志
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));

    const result = await approve("FK001", "t1", 1, "管理员");
    expect(result.payment_no).toBe("FK001");
    // 采购单已付金额更新
    expect(conn.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_purchase_order SET paid_amount"),
      [400, 100, "CG001"]
    );
  });
});
