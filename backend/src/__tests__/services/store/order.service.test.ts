import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: vi.fn(() => "IL20260815001"),
}));

import { listOrders, getOrderDetail, acceptOrder, cancelOrder, rejectOrder } from "../../../services/store/order.service";

describe("store/order.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("listOrders：分页列表与总数", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      { orderNo: "DD001", orderStatus: "PENDING_SHIP", payableAmount: 100 },
    ]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const result = await listOrders({ page: 1, pageSize: 20, tenantId: "t1", storeId: 1, status: "PENDING_SHIP" });
    expect(result.total).toBe(1);
    expect(result.records[0].orderNo).toBe("DD001");
  });

  it("getOrderDetail：返回订单详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      orderNo: "DD001", storeId: 1, orderStatus: "PENDING_PAYMENT", payableAmount: 50,
    });
    const order = await getOrderDetail("DD001", "t1");
    expect(order?.orderNo).toBe("DD001");
  });

  it("acceptOrder：更新订单为待发货", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    await acceptOrder("DD001", "t1");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_miniapp_order"),
      expect.arrayContaining(["DD001"]),
      "t1"
    );
  });

  it("cancelOrder：释放预留并取消", async () => {
    const conn = { query: vi.fn(), execute: vi.fn() };
    conn.query
      .mockResolvedValueOnce([[{ order_no: "DD001", store_id: 1 }]])
      .mockResolvedValueOnce([[{ skuId: 10, reservedQty: 2 }]]);
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));
    await cancelOrder("DD001", 1, "t1");
    const updateCalls = conn.execute.mock.calls;
    expect(String(updateCalls[updateCalls.length - 1][0])).toContain("UPDATE t_miniapp_order");
    expect(updateCalls[updateCalls.length - 1][1]).toContain("CANCELLED");
  });

  it("rejectOrder：释放预留并驳回", async () => {
    const conn = { query: vi.fn(), execute: vi.fn() };
    conn.query
      .mockResolvedValueOnce([[{ order_no: "DD001", store_id: 1 }]])
      .mockResolvedValueOnce([[{ skuId: 10, reservedQty: 2 }]]);
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));
    await rejectOrder("DD001", 1, "t1");
    const updateCalls = conn.execute.mock.calls;
    expect(updateCalls[updateCalls.length - 1][1]).toContain("REJECTED");
  });
});
