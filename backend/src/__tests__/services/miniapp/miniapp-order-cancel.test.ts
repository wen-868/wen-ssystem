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

import { cancelOrder, queryPayResult, getOrderLogistics, deleteOrder } from "../../../services/miniapp.service";

describe("miniapp order cancel/pay-result", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("cancelOrder：更新订单状态并释放预留库存", async () => {
    const conn = { query: vi.fn(), execute: vi.fn() };
    conn.query
      .mockResolvedValueOnce([[{ order_no: "DD001", store_id: 1, customer_type: "RETAIL" }]]) // 订单查询
      .mockResolvedValueOnce([[{ sku_id: 10, reserved_qty: 2 }]]); // 明细查询
    conn.execute.mockImplementation(async (sql: string) => {
      const s = String(sql);
      if (s.includes("FROM t_order_progress_event")) return [[]];
      if (s.includes("INSERT INTO t_order_progress_event")) return [{ affectedRows: 1 }];
      if (s.includes("UPDATE t_miniapp_order")) return [{ affectedRows: 1 }];
      if (s.includes("UPDATE t_inventory_balance")) return [{ affectedRows: 1 }];
      return [{ affectedRows: 0 }];
    });
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));

    const result = await cancelOrder("DD001", "t1", "不想要了");

    expect(result.status).toBe("CANCELLED");
    // 释放库存 UPDATE
    expect(conn.execute).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_inventory_balance"),
      [2, 1, 10]
    );
    // 更新订单状态（不是最后一个 execute，因为之后还有进度事件写入）
    const updateCalls = conn.execute.mock.calls.filter((c) => String(c[0]).includes("UPDATE t_miniapp_order"));
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    expect(String(updateCalls[updateCalls.length - 1][0])).toContain("CANCELLED");
    // 进度事件写入（03 契约 §8.1）
    const eventCalls = conn.execute.mock.calls.filter((c) => String(c[0]).includes("t_order_progress_event"));
    expect(eventCalls.length).toBeGreaterThanOrEqual(1);
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

  it("getOrderLogistics：从订单字段推导轨迹", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      order_status: "COMPLETED",
      delivery_status: "COMPLETED",
      created_at: "2026-08-01 10:00:00",
      paid_at: "2026-08-01 10:05:00",
      completed_at: "2026-08-01 18:00:00",
      cancelled_at: null,
    });
    const result = await getOrderLogistics("DD001", "t1");
    expect(result.status).toBe("COMPLETED");
    expect(result.traces.length).toBeGreaterThanOrEqual(3);
    expect(result.traces[0].desc).toBe("订单已提交");
  });

  it("deleteOrder：已取消订单可软删", async () => {
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });
    const result = await deleteOrder("DD001", "t1");
    expect(result.deleted).toBe(true);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("SET deleted_at = NOW()"),
      ["DD001", "t1"]
    );
  });

  it("deleteOrder：状态不可删时抛错", async () => {
    mocks.query.mockResolvedValueOnce({ affectedRows: 0 });
    await expect(deleteOrder("DD001", "t1")).rejects.toThrow("不可删除");
  });
});
