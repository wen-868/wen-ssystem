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

import { listOrders, getOrderDetail, acceptOrder, cancelOrder, rejectOrder, startDelivery } from "../../../services/store/order.service";

/**
 * 事件感知 conn 桩（TOTAL-ORDER-PROGRESS-03）：
 * 按 SQL 文本分派返回值，覆盖业务读写 + 写入器（SELECT 去重/SELECT MAX/INSERT 事件）。
 */
function makeEventAwareConn(opts: {
  truthRow: { store_id: number | string; customer_type: string; order_status: string } | null;
}) {
  const conn: any = { execute: vi.fn(), query: vi.fn() };
  conn.execute.mockImplementation(async (sql: string, params?: unknown[]) => {
    const s = String(sql);
    if (s.includes("FROM t_order_progress_event")) {
      if (/MAX\(progress_seq\)/i.test(s)) return [[{ max_seq: 0 }]];
      return [[]]; // 去重读：无既有事件
    }
    if (s.includes("INSERT INTO t_order_progress_event")) return [{ affectedRows: 1 }];
    if (/SELECT\s+order_status\s+FROM t_miniapp_order/i.test(s)) return [[{ order_status: opts.truthRow?.order_status ?? "ACCEPTED" }]];
    if (s.includes("FROM t_miniapp_order") && s.includes("FOR UPDATE")) {
      return [[opts.truthRow].filter(Boolean)];
    }
    if (s.includes("UPDATE t_miniapp_order")) return [{ affectedRows: opts.truthRow ? 1 : 0 }];
    return [{ affectedRows: 0 }];
  });
  return conn;
}

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

  it("acceptOrder：包事务更新为 ACCEPTED 并同事务写进度事件（03）", async () => {
    const conn = makeEventAwareConn({
      truthRow: { store_id: 1, customer_type: "RETAIL", order_status: "ACCEPTED" },
    });
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));
    const result = await acceptOrder("DD001", "t1");
    expect(result).toEqual({ orderNo: "DD001", status: "ACCEPTED" });
    const updateCall = conn.execute.mock.calls.find((c) => String(c[0]).includes("UPDATE t_miniapp_order"));
    expect(String(updateCall?.[0])).toContain("order_status = 'ACCEPTED'");
    const eventInsert = conn.execute.mock.calls.find((c) => String(c[0]).includes("INSERT INTO t_order_progress_event"));
    expect(eventInsert).toBeTruthy();
    expect(String(eventInsert?.[0])).toContain("business_stage");
    // 事件阶段参数 = ACCEPTED（值数组第 9 位）
    expect(eventInsert?.[1]).toContain("ACCEPTED");
  });

  it("acceptOrder：订单不可命中 ⇒ 返回 null 且不写事件", async () => {
    const conn = makeEventAwareConn({ truthRow: null });
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));
    const result = await acceptOrder("DD404", "t1");
    expect(result).toBeNull();
    expect(conn.execute.mock.calls.some((c) => String(c[0]).includes("t_order_progress_event"))).toBe(false);
  });

  it("cancelOrder：释放预留并取消 + 同事务写 CANCELLED 事件（03）", async () => {
    const conn = { query: vi.fn(), execute: vi.fn() };
    conn.query
      .mockResolvedValueOnce([[{ order_no: "DD001", store_id: 1, customer_type: "RETAIL" }]])
      .mockResolvedValueOnce([[{ skuId: 10, reservedQty: 2 }]]);
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));
    await cancelOrder("DD001", 1, "t1");
    const updateCall = conn.execute.mock.calls.find((c) => String(c[0]).includes("UPDATE t_miniapp_order"));
    expect(updateCall?.[1]).toContain("CANCELLED");
    const eventInsert = conn.execute.mock.calls.find((c) => String(c[0]).includes("INSERT INTO t_order_progress_event"));
    expect(eventInsert).toBeTruthy();
    expect(eventInsert?.[1]).toContain("CANCELLED");
    expect(eventInsert?.[1]).toContain("order.progress.miniapp_retail.cancelled");
  });

  it("rejectOrder：释放预留并驳回 ⇒ 业务态 REJECTED，不冒充 CANCELLED 事件（03 契约缺口）", async () => {
    const conn = { query: vi.fn(), execute: vi.fn() };
    conn.query
      .mockResolvedValueOnce([[{ order_no: "DD001", store_id: 1, customer_type: "RETAIL" }]])
      .mockResolvedValueOnce([[{ skuId: 10, reservedQty: 2 }]]);
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));
    await rejectOrder("DD001", 1, "t1");
    const updateCall = conn.execute.mock.calls.find((c) => String(c[0]).includes("UPDATE t_miniapp_order"));
    expect(updateCall?.[1]).toContain("REJECTED");
    // REJECTED 不在契约 §三 miniapp_retail 值域 ⇒ 禁止写事件（卡 §五·一.3）
    expect(conn.execute.mock.calls.some((c) => String(c[0]).includes("t_order_progress_event"))).toBe(false);
  });

  it("startDelivery：状态与操作日志同事务并写 DELIVERING 事件（03）", async () => {
    const conn = { execute: vi.fn(), query: vi.fn() };
    conn.execute.mockImplementation(async (sql: string, params?: unknown[]) => {
      const s = String(sql);
      if (s.includes("FROM t_order_progress_event")) {
        if (/MAX\(progress_seq\)/i.test(s)) return [[{ max_seq: 1 }]];
        return [[]];
      }
      if (s.includes("INSERT INTO t_order_progress_event")) return [{ affectedRows: 1 }];
      if (/SELECT\s+order_status\s+FROM t_miniapp_order/i.test(s)) return [[{ order_status: "DELIVERING" }]];
      if (s.includes("FROM t_miniapp_order") && s.includes("FOR UPDATE")) return [[{ store_id: 1, customer_type: "RETAIL", order_status: "WAIT_DELIVERY" }]];
      if (s.includes("UPDATE t_miniapp_order")) return [{ affectedRows: 1 }];
      if (s.includes("INSERT INTO t_operation_log")) return [{ affectedRows: 1 }];
      return [{ affectedRows: 0 }];
    });
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));
    const result = await startDelivery("DD001", "t1", 7, "店员A");
    expect(result).toEqual({ orderNo: "DD001", status: "DELIVERING" });
    const calls = conn.execute.mock.calls.map((c) => String(c[0]));
    const logIdx = calls.findIndex((c) => c.includes("INSERT INTO t_operation_log"));
    const eventIdx = calls.findIndex((c) => c.includes("INSERT INTO t_order_progress_event"));
    expect(logIdx).toBeGreaterThanOrEqual(0);
    expect(eventIdx).toBeGreaterThanOrEqual(0);
  });
});
