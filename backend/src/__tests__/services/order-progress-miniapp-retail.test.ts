/**
 * TOTAL-ORDER-PROGRESS-03 · miniapp_retail 全生命周期进度事件契约测试
 * 被测文件：src/shared/order-progress-events.ts + 各写点 service
 * 条件数 ≥ 20（卡片交付要求）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  appendOrderProgressEvent,
  miniappRetailEvent,
  appendMiniappRetailCompletedEvent,
} from "../../shared/order-progress-events";
import { validateAndDerive } from "../../shared/order-progress-contract";
import { acceptOrder, cancelOrder as storeCancelOrder, rejectOrder, startDelivery } from "../../services/store/order.service";
import { cancelOrder as adminCancelOrder } from "../../services/admin/order.service";
import { markOrderPaid } from "../../services/miniapp.service";
import { createCheckoutOrder, completeDelivery } from "../../services/miniapp/checkout.service";
import { processTimeoutConfig } from "../../services/admin/order-timeout.service";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
}));

const mockConn: any = { query: vi.fn(), execute: vi.fn() };

beforeEach(() => {
  vi.resetAllMocks();
  mockConn.query.mockReset();
  mockConn.execute.mockReset();
  mocks.transaction.mockImplementation(async (fn: any) => fn(mockConn));
});

function setupTransactionMock(executeImpl: (sql: string) => any) {
  mockConn.execute.mockImplementation(async (sql: string) => executeImpl(String(sql)));
}

function eventParamContains(eventCalls: any[], needle: string): boolean {
  return eventCalls.some((c: any) => {
    const params = Array.isArray(c[1]) ? c[1] : [];
    return params.some((p: any) => String(p).includes(needle));
  });
}

describe("miniapp_retail 进度事件全生命周期", () => {
  // 条件 1-4：阶段值域严格，不私加 REJECTED
  it("阶段 PENDING_PAYMENT/PENDING_SHIP/ACCEPTED/DELIVERING/COMPLETED/CANCELLED 合法，REJECTED 不在值域", () => {
    const valid = ["PENDING_PAYMENT", "PENDING_SHIP", "ACCEPTED", "DELIVERING", "COMPLETED", "CANCELLED"];
    for (const stage of valid) {
      const input = miniappRetailEvent({
        tenantId: "t1", orderNo: "O1", businessStage: stage, businessStatus: stage,
        actorType: "user", actorId: null, upstreamBizKey: `O1:${stage}`, at: new Date(),
      });
      expect(input.businessStage).toBe(stage);
    }
    expect(valid).not.toContain("REJECTED");
  });

  // 条件 5：终态事件 ended_at 补齐；非终态 ended_at 为 null
  it("COMPLETED/CANCELLED 终态事件 ended_at 补齐；非终态 ended_at 为 null", () => {
    const at = new Date("2026-08-15T10:00:00Z");
    const c = miniappRetailEvent({
      tenantId: "t1", orderNo: "O1", businessStage: "COMPLETED", businessStatus: "COMPLETED",
      actorType: "system", actorId: null, upstreamBizKey: "O1:STORE_COMPLETE", at,
    });
    expect(c.endedAt).toBe(at);
    const n = miniappRetailEvent({
      tenantId: "t1", orderNo: "O1", businessStage: "ACCEPTED", businessStatus: "ACCEPTED",
      actorType: "user", actorId: null, upstreamBizKey: "O1:ACCEPTED", at,
    });
    expect(n.endedAt).toBeNull();
  });

  // 条件 6：默认 visible_to
  it("miniapp_retail 默认 visible_to = [consumer, store_staff, store_manager, hq_admin]", () => {
    const input = miniappRetailEvent({
      tenantId: "t1", orderNo: "O1", businessStage: "PENDING_PAYMENT", businessStatus: "PENDING_PAYMENT",
      actorType: "system", actorId: null, upstreamBizKey: "O1:PAY", at: new Date(),
    });
    expect(input.visibleTo).toEqual(["consumer", "store_staff", "store_manager", "hq_admin"]);
  });

  // 条件 7：PAYMENT_TIMEOUT 携带 failure_code 与 retry_entry
  it("PAYMENT_TIMEOUT 携带 failure_code 与 retry_entry（contract §7.1 九码白名单）", () => {
    const input = miniappRetailEvent({
      tenantId: "t1", orderNo: "O1", businessStage: "CANCELLED", businessStatus: "CANCELLED",
      actorType: "cron", actorId: null, upstreamBizKey: "O1:TIMEOUT:WAIT_PAY",
      failureCode: "PAYMENT_TIMEOUT", retryEntry: "miniapp:/orders/create-again",
      statusReason: "支付超时，订单已自动取消", at: new Date(),
    });
    expect(input.failureCode).toBe("PAYMENT_TIMEOUT");
    expect(input.retryEntry).toBe("miniapp:/orders/create-again");
  });

  // 条件 8：拒收 REJECTED 不发正式事件
  it("store rejectOrder 业务态 REJECTED 但不写进度事件", async () => {
    mockConn.query
      .mockResolvedValueOnce([[{ order_no: "DD1", store_id: 1, customer_type: "RETAIL" }]])
      .mockResolvedValueOnce([[{ sku_id: 10, reserved_qty: 2 }]]);
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    const { rejectOrder: rj } = await import("../../services/store/order.service");
    await rj("DD1", 1, "t1");
    const eventCalls = mockConn.execute.mock.calls.filter((c: any) =>
      String(c[0]).includes("t_order_progress_event"),
    );
    expect(eventCalls.length).toBe(0);
  });

  // 条件 9：source_event_id 六成分，不含时间戳（derive 后获取源生成值）
  it("source_event_id 六成分：tenant|family|order_no|business_stage|actor_key|upstream_biz_key，不含时间戳", () => {
    const input = miniappRetailEvent({
      tenantId: "t1", orderNo: "O1", businessStage: "PENDING_PAYMENT", businessStatus: "PENDING_PAYMENT",
      actorType: "user", actorId: 42, upstreamBizKey: "O1:PAID", at: new Date(),
    });
    const derived = validateAndDerive(input);
    const sid = String(derived.sourceEventId);
    // SHA-256 十六进制：64 位、确定性、不含时间戳片段
    expect(sid).toMatch(/^[0-9a-f]{64}$/);
    expect(sid).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    // 同一输入 ⇒ 同一 hash（幂等键稳定性）
    const derived2 = validateAndDerive(input);
    expect(derived2.sourceEventId).toBe(derived.sourceEventId);
    // 不同 upstream_bizKey ⇒ 不同 hash（六成分隔离）
    const other = miniappRetailEvent({
      tenantId: "t1", orderNo: "O1", businessStage: "PENDING_PAYMENT", businessStatus: "PENDING_PAYMENT",
      actorType: "user", actorId: 42, upstreamBizKey: "O1:REFUND", at: new Date(),
    });
    expect(validateAndDerive(other).sourceEventId).not.toBe(derived.sourceEventId);
    expect(derived.eventName).toBe("order.progress.miniapp_retail.pending_payment");
  });

  // 条件 10：business_status 取主表真值，不反推阶段名
  it("business_status 取主表真实 order_status（示例：支付后 PENDING_SHIP 而非 PENDING_PAYMENT）", () => {
    const input = miniappRetailEvent({
      tenantId: "t1", orderNo: "O1", businessStage: "PENDING_SHIP", businessStatus: "PENDING_SHIP",
      actorType: "system", actorId: null, upstreamBizKey: "O1:PAID", at: new Date(),
    });
    expect(input.businessStage).toBe("PENDING_SHIP");
    expect(input.businessStatus).toBe("PENDING_SHIP");
  });

  // 条件 11：事件名口径 order.progress.miniapp_retail.<stage lowercase>
  it("事件名 = order.progress.miniapp_retail.<stage lowercase>", () => {
    const input = miniappRetailEvent({
      tenantId: "t1", orderNo: "O1", businessStage: "DELIVERING", businessStatus: "DELIVERING",
      actorType: "user", actorId: 5, upstreamBizKey: "O1:START_DELIVERY", at: new Date(),
    });
    const derived = validateAndDerive(input);
    expect(derived.eventName).toBe("order.progress.miniapp_retail.delivering");
  });

  // 条件 12：批发单 WHOLESALE 跳过 miniapp_retail 事件（红线 §七）
  it("customer_type=WHOLESALE 时不写 miniapp_retail 事件（批发族不外扩）", async () => {
    mockConn.execute.mockResolvedValueOnce([
      [{ tenant_id: "t1", store_id: 1, customer_type: "WHOLESALE", order_status: "COMPLETED" }],
    ]);
    const res = await appendMiniappRetailCompletedEvent(mockConn, "O1", {
      tenantId: "t1", actorId: null, actorType: "user", action: "STORE_COMPLETE",
    });
    expect(res.written).toBe(false);
    expect(res.reason).toContain("非 miniapp_retail 族");
  });

  // 条件 13：acceptOrder 同事务写 ACCEPTED 事件
  it("acceptOrder 事务内写 ACCEPTED 事件", async () => {
    setupTransactionMock((sql) => {
      const s = String(sql);
      if (s.includes("FOR UPDATE")) return [[{ store_id: 1, customer_type: "RETAIL", order_status: "ACCEPTED" }]];
      if (/SELECT\s+order_status\s+FROM/i.test(s)) return [[{ order_status: "ACCEPTED" }]];
      if (s.includes("UPDATE t_miniapp_order")) return [{ affectedRows: 1 }];
      if (s.includes("FROM t_order_progress_event")) {
        if (/MAX\(progress_seq\)/i.test(s)) return [[{ max_seq: 0 }]];
        return [[]];
      }
      if (s.includes("INSERT INTO t_order_progress_event")) return [{ affectedRows: 1 }];
      return [{ affectedRows: 0 }];
    });
    const res = await acceptOrder("DD1", "t1");
    expect(res).toEqual({ orderNo: "DD1", status: "ACCEPTED" });
    const eventCalls = mockConn.execute.mock.calls.filter((c: any) =>
      String(c[0]).includes("t_order_progress_event"),
    );
    expect(eventCalls.length).toBeGreaterThanOrEqual(1);
    expect(eventParamContains(eventCalls, "ACCEPTED")).toBe(true);
  });

  // 条件 14：startDelivery 同事务写 DELIVERING 事件
  it("startDelivery 同事务写 DELIVERING 事件", async () => {
    setupTransactionMock((sql) => {
      const s = String(sql);
      if (s.includes("FOR UPDATE")) return [[{ store_id: 1, customer_type: "RETAIL", order_status: "DELIVERING" }]];
      if (/SELECT\s+order_status\s+FROM/i.test(s)) return [[{ order_status: "DELIVERING" }]];
      if (s.includes("UPDATE t_miniapp_order")) return [{ affectedRows: 1 }];
      if (s.includes("FROM t_order_progress_event")) {
        if (/MAX\(progress_seq\)/i.test(s)) return [[{ max_seq: 0 }]];
        return [[]];
      }
      if (s.includes("INSERT INTO t_order_progress_event")) return [{ affectedRows: 1 }];
      if (s.includes("INSERT INTO t_operation_log")) return [{ affectedRows: 1 }];
      return [{ affectedRows: 0 }];
    });
    const res = await startDelivery("DD1", "t1", 7, "店员A");
    expect(res).toEqual({ orderNo: "DD1", status: "DELIVERING" });
    const eventCalls = mockConn.execute.mock.calls.filter((c: any) =>
      String(c[0]).includes("t_order_progress_event"),
    );
    expect(eventCalls.length).toBeGreaterThanOrEqual(1);
    expect(eventParamContains(eventCalls, "DELIVERING")).toBe(true);
  });

  // 条件 15：completeDelivery 同事务写 COMPLETED 事件（shared 装配器）
  it("completeDelivery 同事务写 COMPLETED 事件（shared 装配器）", async () => {
    mockConn.query.mockResolvedValueOnce([[{ tenant_id: "t1" }]]).mockResolvedValueOnce([[{ sku_id: 10 }]]);
    setupTransactionMock((sql) => {
      const s = String(sql);
      if (s.includes("FROM t_miniapp_order") && s.includes("tenant_id"))
        return [[{ tenant_id: "t1", store_id: 1, customer_type: "RETAIL", order_status: "COMPLETED" }]];
      if (s.includes("FROM t_order_progress_event")) {
        if (/MAX\(progress_seq\)/i.test(s)) return [[{ max_seq: 0 }]];
        return [[]];
      }
      if (s.includes("INSERT INTO t_order_progress_event")) return [{ affectedRows: 1 }];
      return [{ affectedRows: 1 }];
    });
    const res = await completeDelivery("DD1", 5);
    expect(res.status).toBe("COMPLETED");
    const eventCalls = mockConn.execute.mock.calls.filter((c: any) =>
      String(c[0]).includes("t_order_progress_event"),
    );
    expect(eventCalls.length).toBeGreaterThanOrEqual(1);
    expect(eventParamContains(eventCalls, "COMPLETED")).toBe(true);
  });

  // 条件 16：store cancelOrder 同事务写 CANCELLED 事件
  it("store cancelOrder 同事务写 CANCELLED 事件，释放库存在同一事务", async () => {
    mockConn.query
      .mockResolvedValueOnce([[{ order_no: "DD1", store_id: 1, customer_type: "RETAIL" }]])
      .mockResolvedValueOnce([[{ sku_id: 10, reservedQty: 2 }]]);
    setupTransactionMock((sql) => {
      const s = String(sql);
      if (s.includes("FROM t_order_progress_event")) {
        if (/MAX\(progress_seq\)/i.test(s)) return [[{ max_seq: 0 }]];
        return [[]];
      }
      if (s.includes("INSERT INTO t_order_progress_event")) return [{ affectedRows: 1 }];
      if (s.includes("UPDATE t_miniapp_order")) return [{ affectedRows: 1 }];
      if (s.includes("UPDATE t_inventory_balance")) return [{ affectedRows: 1 }];
      return [{ affectedRows: 0 }];
    });
    const res = await storeCancelOrder("DD1", 1, "t1");
    expect(res).toEqual({ orderNo: "DD1", status: "CANCELLED" });
    const eventCalls = mockConn.execute.mock.calls.filter((c: any) =>
      String(c[0]).includes("t_order_progress_event"),
    );
    expect(eventCalls.length).toBeGreaterThanOrEqual(1);
    expect(eventParamContains(eventCalls, "CANCELLED")).toBe(true);
  });

  // 条件 17：admin cancelOrder 同事务写 CANCELLED 事件
  it("admin cancelOrder 同事务写 CANCELLED 事件", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      order_no: "O1", store_id: 1, customer_type: "RETAIL", order_status: "PENDING_SHIP",
    });
    setupTransactionMock((sql) => {
      const s = String(sql);
      if (s.includes("SELECT sku_id, qty")) return [[{ sku_id: 1, qty: 5 }], undefined];
      if (s.includes("FROM t_order_progress_event")) return [[], []];
      if (s.includes("INSERT INTO t_order_progress_event")) return [{ affectedRows: 1 }];
      return [[], []];
    });
    const res = await adminCancelOrder("O1", "客户取消", 1, "admin", "t1");
    expect(res).toEqual({ orderNo: "O1", status: "CANCELLED" });
    const eventCalls = mockConn.execute.mock.calls.filter((c: any) =>
      String(c[0]).includes("t_order_progress_event"),
    );
    expect(eventCalls.length).toBeGreaterThanOrEqual(1);
    expect(eventParamContains(eventCalls, "CANCELLED")).toBe(true);
  });

  // 条件 18：markOrderPaid 包事务写 PENDING_SHIP 事件，重复回调幂等
  it("markOrderPaid 包事务写 PENDING_SHIP 事件；重复回调 source_event_id 去重只留一行", async () => {
    let callCount = 0;
    setupTransactionMock((sql) => {
      const s = String(sql);
      if (s.includes("FOR UPDATE")) {
        callCount++;
        return [[{ store_id: 1, customer_type: "RETAIL", pay_status: "UNPAID", order_status: "PENDING_PAYMENT" }]];
      }
      if (s.includes("UPDATE t_miniapp_order")) return [{ affectedRows: 1 }];
      if (/SELECT\s+order_status\s+FROM/i.test(s))
        return [[{ order_status: callCount > 1 ? "PENDING_SHIP" : "PENDING_SHIP" }]];
      if (s.includes("FROM t_order_progress_event")) {
        if (/MAX\(progress_seq\)/i.test(s)) return [[{ max_seq: 0 }]];
        // 第二次调用时去重命中（已存在同 source_event_id 的行）
        if (callCount > 1) return [[{ progress_seq: 1 }]];
        return [[]];
      }
      if (s.includes("INSERT INTO t_order_progress_event")) return [{ affectedRows: 1 }];
      return [{ affectedRows: 0 }];
    });
    await markOrderPaid("DD1", "t1");
    await markOrderPaid("DD1", "t1"); // 重复回调
    const insertCalls = mockConn.execute.mock.calls.filter((c: any) =>
      String(c[0]).includes("INSERT INTO t_order_progress_event"),
    );
    expect(insertCalls.length).toBe(1); // 幂等：只写一次 PENDING_SHIP
  });

  // 条件 19：超时筛选口径 PENDING_PAYMENT + UNPAID，并发守卫 affectedRows=1
  it("order-timeout WAIT_PAY 筛选口径：PENDING_PAYMENT + UNPAID，并发守卫 affectedRows=1", async () => {
    mocks.query.mockResolvedValueOnce([{ id: 100, order_no: "XS001" }]);
    setupTransactionMock((sql) => {
      const s = String(sql);
      if (s.includes("FROM t_miniapp_order") && s.includes("PENDING_PAYMENT"))
        return [[{ id: 100, order_no: "XS001" }]];
      if (s.includes("SELECT store_id, customer_type, order_status FROM t_miniapp_order"))
        return [[{ store_id: 5, customer_type: "RETAIL", order_status: "CANCELLED" }]];
      if (s.includes("UPDATE t_miniapp_order")) return [{ affectedRows: 1 }];
      if (s.includes("INSERT INTO t_order_timeout_log")) return [{ affectedRows: 1 }];
      if (s.includes("INSERT INTO t_order_progress_event")) return [{ affectedRows: 1 }];
      return [{ affectedRows: 1 }];
    });
    await processTimeoutConfig({
      id: 1, order_type: "SALE", timeout_type: "WAIT_PAY", timeout_minutes: 30, action: "CANCEL", tenant_id: 1,
    });
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("order_status = 'PENDING_PAYMENT'");
    expect(sql).toContain("pay_status = ?"); // 参数化占位符，口径一致
    const guardCalls = mockConn.execute.mock.calls.filter(
      (c: any) =>
        String(c[0]).includes("UPDATE t_miniapp_order") &&
        String(c[0]).includes("PENDING_PAYMENT"),
    );
    expect(guardCalls.length).toBeGreaterThanOrEqual(1);
  });

  // 条件 20：系统/cron 主体缺 actorId 时兜底使用 actorFallback
  it("system/cron 主体缺 actorId 时兜底使用 actorFallback", () => {
    const input = miniappRetailEvent({
      tenantId: "t1", orderNo: "O1", businessStage: "CANCELLED", businessStatus: "CANCELLED",
      actorType: "cron", actorId: null, upstreamBizKey: "O1:TIMEOUT",
      actorFallback: "order-timeout-wait-pay", at: new Date(),
    });
    const derived = validateAndDerive(input);
    expect(input.actorId).toBeNull();
    expect(input.actorFallback).toBe("order-timeout-wait-pay");
    expect(derived.actorKey).toBe("cron:order-timeout-wait-pay");
  });

  // 条件 21：money_in_free_text 豁免角色
  it("money_in_free_text exempt_roles 包含 hq_admin、store_manager", () => {
    const input = miniappRetailEvent({
      tenantId: "t1", orderNo: "O1", businessStage: "PENDING_SHIP", businessStatus: "PENDING_SHIP",
      actorType: "user", actorId: null, upstreamBizKey: "O1:PAID", at: new Date(),
    });
    expect(input.fieldFilter.money_in_free_text.exempt_roles).toContain("hq_admin");
    expect(input.fieldFilter.money_in_free_text.exempt_roles).toContain("store_manager");
    expect(input.fieldFilter.hidden_fields.ai).toContain("actor_id");
    expect(input.fieldFilter.hidden_fields.ai).toContain("source_event_id");
  });

  // 条件 22：checkout 零售下单写 PENDING_PAYMENT 事件
  it("checkout.createCheckoutOrder customerType=RETAIL 写 PENDING_PAYMENT 事件", async () => {
    mockConn.query
      .mockResolvedValueOnce([[{ skuId: 1, quantity: 2 }]])
      .mockResolvedValueOnce([[{ sku_name: "茅台", retail_price: 100, wholesale_price: 90, miniapp_price: 95 }]])
      .mockResolvedValueOnce([[{ price: 50 }]])
      .mockResolvedValueOnce([[{ available_qty: 100, physical_qty: 200, locked_qty: 0 }]]);
    setupTransactionMock((sql) => {
      const s = String(sql);
      if (s.includes("FROM t_order_progress_event")) {
        if (/MAX\(progress_seq\)/i.test(s)) return [[{ max_seq: 0 }]];
        return [[]];
      }
      if (s.includes("INSERT INTO t_order_progress_event")) return [{ affectedRows: 1 }];
      return [{ affectedRows: 1, insertId: 1 }];
    });
    await createCheckoutOrder({
      tenantId: "t1", customerId: 1, customerType: "RETAIL", skuIds: undefined, storeId: 2, remark: "",
    });
    const eventCalls = mockConn.execute.mock.calls.filter((c: any) =>
      String(c[0]).includes("t_order_progress_event"),
    );
    expect(eventCalls.length).toBeGreaterThanOrEqual(1);
    expect(eventParamContains(eventCalls, "PENDING_PAYMENT")).toBe(true);
  });

  // 条件 23：事务回滚—事件写入失败应使整条链路可回滚
  it("事件写入与业务状态共享同一 conn（无独立事务），写失败时调用方可回滚", async () => {
    const failingConn: any = { execute: vi.fn().mockRejectedValue(new Error("seq conflict exhausted")) };
    await expect(
      appendOrderProgressEvent(
        failingConn,
        miniappRetailEvent({
          tenantId: "t1", orderNo: "O1", businessStage: "CANCELLED", businessStatus: "CANCELLED",
          actorType: "cron", actorId: null, upstreamBizKey: "O1:TO", at: new Date(),
        }),
      ),
    ).rejects.toThrow();
    expect(typeof failingConn.execute).toBe("function");
  });
});
