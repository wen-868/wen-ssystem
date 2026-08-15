import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
}));

import { cancelOrder, queryPayResult } from "../../../services/miniapp.service";

describe("miniapp order cancel/pay-result", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("cancelOrder：更新订单状态并释放预留库存", async () => {
    const conn = { query: vi.fn(), execute: vi.fn() };
    conn.query
      .mockResolvedValueOnce([[{ order_no: "DD001", store_id: 1 }]]) // 订单查询
      .mockResolvedValueOnce([[{ sku_id: 10, reserved_qty: 2 }]]); // 明细查询
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));

    const result = await cancelOrder("DD001", "t1", "不想要了");

    expect(result.status).toBe("CANCELLED");
    // 释放库存 UPDATE
    expect(conn.execute).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_inventory_balance"),
      [2, 1, 10]
    );
    // 更新订单状态
    const updateCalls = conn.execute.mock.calls;
    expect(String(updateCalls[updateCalls.length - 1][0])).toContain("UPDATE t_miniapp_order");
    expect(String(updateCalls[updateCalls.length - 1][0])).toContain("CANCELLED");
  });

  it("cancelOrder：订单不存在或状态不可取消时抛错", async () => {
    const conn = { query: vi.fn().mockResolvedValueOnce([[]]), execute: vi.fn() };
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));
    await expect(cancelOrder("DD999", "t1")).rejects.toThrow("订单不存在或当前状态不可取消");
  });

  it("queryPayResult：返回已支付状态", async () => {
    mocks.queryOne.mockResolvedValueOnce({ payStatus: "PAID" });
    const result = await queryPayResult("DD001", "t1");
    expect(result.paid).toBe(true);
  });

  it("queryPayResult：未支付返回 false", async () => {
    mocks.queryOne.mockResolvedValueOnce({ payStatus: "UNPAID" });
    const result = await queryPayResult("DD001", "t1");
    expect(result.paid).toBe(false);
  });
});
