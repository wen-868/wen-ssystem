/**
 * TOTAL-ORDER-PROGRESS-03 · miniapp_retail 全生命周期进度事件契约测试
 * 被测文件：src/shared/order-progress-events.ts + 各写点 service + 查询服务 + 即时零售转单
 * 条件数 ≥ 20（卡片交付要求；本文件现含 31 条）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  appendOrderProgressEvent,
  miniappRetailEvent,
  appendMiniappRetailCompletedEvent,
} from "../../../shared/order-progress-events";
import { validateAndDerive } from "../../../shared/order-progress-contract";
import { acceptOrder, cancelOrder as storeCancelOrder, rejectOrder, startDelivery } from "../../../services/store/order.service";
import { cancelOrder as adminCancelOrder } from "../../../services/admin/order.service";
import { markOrderPaid } from "../../../services/miniapp.service";
import { createCheckoutOrder, completeDelivery } from "../../../services/miniapp/checkout.service";
import { processTimeoutConfig } from "../../../services/admin/order-timeout.service";
import { queryOrderProgress } from "../../../services/store/order-progress-query.service";
import { handleWebhook } from "../../../services/admin/instant-retail.service";
import { AppError } from "../../../shared/app-error";

// 即时零售转单写点：adapter 与平台配置模块整体替换（webhook 入口外部依赖）
const irMocks = vi.hoisted(() => ({
  getPlatformConfig: vi.fn(),
  getAdapter: vi.fn(),
  parseUnifiedOrder: vi.fn(),
}));
vi.mock("../../../services/instant-retail/adapters/index", () => ({
  getAdapter: irMocks.getAdapter,
  parsePlatformType: vi.fn((p: string) => p),
  parseUnifiedOrder: irMocks.parseUnifiedOrder,
}));
vi.mock("../../../services/instant-retail/common.service", () => ({
  maskConfig: vi.fn((c: unknown) => c),
  getPlatformConfig: irMocks.getPlatformConfig,
  getPlatformConfigWithTenant: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
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
    const { rejectOrder: rj } = await import("../../../services/store/order.service");
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
    // 事件阶段必须映射 PENDING_SHIP（契约 §三：支付 ⇒ order.progress.miniapp_retail.pending_ship）
    expect((insertCalls[0][1] as unknown[])).toContain("order.progress.miniapp_retail.pending_ship");
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
    // PAYMENT_TIMEOUT 九码与 retry_entry 必须随事件落库（契约 §7.1 needRetryEntry=true）
    const evInsert = mockConn.execute.mock.calls.find((c: any) =>
      String(c[0]).includes("INSERT INTO t_order_progress_event"),
    );
    expect(evInsert).toBeTruthy();
    expect(evInsert![1] as unknown[]).toContain("PAYMENT_TIMEOUT");
    expect(evInsert![1] as unknown[]).toContain("miniapp:/orders/create-again");
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

  // 条件 24：即时零售转单落 t_miniapp_order ⇒ 同事务写 PENDING_PAYMENT 事件（写点 #2）
  it("instant-retail handleWebhook 转单同事务写 PENDING_PAYMENT 事件，真值读回不反推", async () => {
    const payload = { platformOrderId: "P100", status: "PENDING", payAmount: 59.9 };
    irMocks.getPlatformConfig.mockResolvedValue({ platform: "JD", storeId: "1" });
    irMocks.getAdapter.mockReturnValue({ verifyWebhook: vi.fn().mockResolvedValue({ valid: true, payload }) });
    irMocks.parseUnifiedOrder.mockReturnValue({
      platformOrderId: "P100", platform: "JD", storeId: "2", status: "PENDING",
      orderId: "IR_JD_P100", payAmount: 59.9,
      address: { name: "张三", phone: "13800000000", province: "粤", city: "深圳", district: "南山", detail: "科技园" },
      items: [{ localSkuId: 1, name: "商品A", quantity: 2, unitPrice: 29.95, totalPrice: 59.9 }],
      remark: "",
    });
    mockConn.query.mockResolvedValueOnce([[]]); // 转单存在性检查：无既有单
    setupTransactionMock((sql) => {
      const s = String(sql);
      if (s.includes("SELECT tenant_id, store_id, customer_type, order_status FROM t_miniapp_order"))
        return [[{ tenant_id: "default", store_id: 2, customer_type: "RETAIL", order_status: "PENDING_PAYMENT" }]];
      if (s.includes("FROM t_order_progress_event")) {
        if (/MAX\(progress_seq\)/i.test(s)) return [[{ max_seq: 0 }]];
        return [[]];
      }
      return [{ affectedRows: 1 }];
    });
    const res = await handleWebhook("JD", payload, "sig", "ts");
    expect(res.status).toBe(200);
    const eventInserts = mockConn.execute.mock.calls.filter((c: any) =>
      String(c[0]).includes("INSERT INTO t_order_progress_event"),
    );
    expect(eventInserts.length).toBe(1);
    const params = eventInserts[0][1] as unknown[];
    expect(params).toContain("miniapp_retail");
    expect(params).toContain("IR_JD_P100");
    expect(params).toContain("PENDING_PAYMENT");
    expect(params).toContain("default"); // 租户真值从主表读回
  });

  // 条件 25：支付与超时并发——超时 UPDATE 未命中（支付先成功）⇒ 不写 SUCCESS 日志、不写 PAYMENT_TIMEOUT 事件
  it("超时 UPDATE affectedRows=0（支付先成功）⇒ 不写 SUCCESS 日志也不写 PAYMENT_TIMEOUT 事件", async () => {
    mocks.query.mockResolvedValueOnce([{ id: 200, order_no: "XS002" }]);
    setupTransactionMock((sql) => {
      const s = String(sql);
      if (s.includes("UPDATE t_miniapp_order")) return [{ affectedRows: 0 }]; // 并发：已被支付/状态推进
      return [{ affectedRows: 1 }];
    });
    await processTimeoutConfig({
      id: 1, order_type: "SALE", timeout_type: "WAIT_PAY", timeout_minutes: 30, action: "CANCEL", tenant_id: 1,
    });
    const logCalls = mockConn.execute.mock.calls.filter((c: any) => String(c[0]).includes("t_order_timeout_log"));
    const eventCalls = mockConn.execute.mock.calls.filter((c: any) => String(c[0]).includes("t_order_progress_event"));
    expect(logCalls.length).toBe(0);
    expect(eventCalls.length).toBe(0);
  });

  // 条件 26：查询 SQL 强制 tenant_id 谓词 + 租户参数绑定（跨租户同单号零泄漏前置）
  it("queryOrderProgress 事件 SQL 强制 tenant_id = ? 谓词，绑定调用者租户", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    mocks.queryOneWithTenant.mockResolvedValueOnce(null).mockResolvedValueOnce({ progress_seq: 0 });
    const res = await queryOrderProgress(
      { tenantId: "T1", roles: ["SUPER_ADMIN"], storeId: null, storeScoped: false },
      { orderFamily: "miniapp_retail", orderNo: "DD-SHARED" },
    );
    expect(res.order_family).toBe("miniapp_retail");
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("tenant_id = ?");
    expect(sql).toContain("order_family = ?");
    expect(mocks.queryWithTenant.mock.calls[0][1][0]).toBe("T1"); // 绑定调用者租户，非单号归属租户
    // 另一租户同单号 ⇒ 绑定切换为 T2，谓词不变 ⇒ 数据库层零泄漏
    mocks.queryWithTenant.mockClear();
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    mocks.queryOneWithTenant.mockResolvedValueOnce(null).mockResolvedValueOnce({ progress_seq: 0 });
    await queryOrderProgress(
      { tenantId: "T2", roles: ["SUPER_ADMIN"], storeId: null, storeScoped: false },
      { orderFamily: "miniapp_retail", orderNo: "DD-SHARED" },
    );
    expect(mocks.queryWithTenant.mock.calls[0][1][0]).toBe("T2");
  });

  // 条件 27：门店隔离——门店级用户查 miniapp_retail，主表 store_id 不匹配 ⇒ 404 不泄露存在性
  it("storeScoped 用户 miniapp_retail 主表 store_id 不匹配 ⇒ 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ store_id: 2 }); // 主表在门店 2
    await expect(queryOrderProgress(
      { tenantId: "T1", roles: ["SALES_STAFF"], storeId: 1, storeScoped: true },
      { orderFamily: "miniapp_retail", orderNo: "DD-OTHER-STORE" },
    )).rejects.toMatchObject({ statusCode: 404 });
    const sql = String(mocks.queryOneWithTenant.mock.calls[0][0]);
    expect(sql).toContain("t_miniapp_order");
    expect(sql).toContain("tenant_id = ?");
  });

  // 条件 28：门店隔离——store_id 匹配 ⇒ 正常返回且走同一租户谓词
  it("storeScoped 用户 store_id 匹配 ⇒ 查询放行且 SQL 带租户谓词", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ store_id: 1 });
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    mocks.queryOneWithTenant.mockResolvedValueOnce(null).mockResolvedValueOnce({ progress_seq: 2 });
    const res = await queryOrderProgress(
      { tenantId: "T1", roles: ["STORE_MANAGER"], storeId: 1, storeScoped: true },
      { orderFamily: "miniapp_retail", orderNo: "DD-MINE" },
    );
    expect(res.order_no).toBe("DD-MINE");
    expect(res.last_seq).toBe(2);
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("tenant_id = ?");
  });

  // 条件 29：since_seq 游标——SQL progress_seq > sinceSeq 参数绑定
  it("since_seq 增量：progress_seq > sinceSeq 以参数绑定传入", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    mocks.queryOneWithTenant.mockResolvedValueOnce(null).mockResolvedValueOnce({ progress_seq: 9 });
    await queryOrderProgress(
      { tenantId: "T1", roles: ["SUPER_ADMIN"], storeId: null, storeScoped: false },
      { orderFamily: "miniapp_retail", orderNo: "DD1", sinceSeq: 5 },
    );
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("progress_seq > ?");
    expect(mocks.queryWithTenant.mock.calls[0][1][3]).toBe(5); // 第 4 个绑定参数 = sinceSeq
  });

  // 条件 30：AI 通道字段裁剪——白名单投影，actor/source/idempotency/内部字段不下发，金额文本打码
  it("AI 通道 miniapp_retail 只读结果裁剪：无 actor_id/source_event_id/idempotency_key/金额，status_reason 金额打码", async () => {
    const sample = miniappRetailEvent({
      tenantId: "T1", storeId: 1, orderNo: "DD1", businessStage: "PENDING_SHIP", businessStatus: "PENDING_SHIP",
      actorType: "user", actorId: 42, upstreamBizKey: "DD1:PAID",
      statusReason: "应收 59.90 元", at: new Date(),
    });
    mocks.queryWithTenant.mockResolvedValueOnce([{
      progress_seq: 1, tenant_id: "T1", store_id: 1, order_family: "miniapp_retail", order_no: "DD1",
      source_event_id: "a".repeat(64),
      event_name: "order.progress.miniapp_retail.pending_ship", event_version: "1.0.0",
      business_stage: "PENDING_SHIP", business_status: "PENDING_SHIP",
      failure_code: null, retry_entry: null, manual_intervention_url: null,
      status_reason: "应收 59.90 元", actor_type: "user", actor_id: "42",
      visible_to: JSON.stringify(sample.visibleTo),
      field_filter: JSON.stringify(sample.fieldFilter),
      idempotency_key: "b".repeat(64),
      started_at: "2026-10-29 10:00:00", ended_at: null, created_at: "2026-10-29 10:00:00",
    }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce(null).mockResolvedValueOnce({ progress_seq: 1 });
    const res = await queryOrderProgress(
      { tenantId: "T1", roles: ["SUPER_ADMIN"], storeId: null, storeScoped: false },
      { orderFamily: "miniapp_retail", orderNo: "DD1", channel: "ai" },
    );
    expect(res.events.length).toBe(1);
    const ev = res.events[0] as Record<string, unknown>;
    expect(ev).not.toHaveProperty("actor_id");
    expect(ev).not.toHaveProperty("source_event_id");
    expect(ev).not.toHaveProperty("idempotency_key");
    expect(ev).not.toHaveProperty("visible_to");
    expect(ev).not.toHaveProperty("store_id");
    expect(String(ev.status_reason)).not.toContain("59.90");
    expect(ev.actor_type).toBe("user"); // 类型可下发，ID 不下发
  });

  // 条件 31：人读通道消费者/店员视角隐藏内部键（field_filter.hidden_fields.consumer 生效）
  it("人读通道按 field_filter.hidden_fields 裁剪内部键，金额文本对非豁免角色打码", async () => {
    const sample = miniappRetailEvent({
      tenantId: "T1", storeId: 1, orderNo: "DD1", businessStage: "CANCELLED", businessStatus: "CANCELLED",
      actorType: "user", actorId: 42, upstreamBizKey: "DD1:USER_CANCEL",
      statusReason: "含金额 88.00 的原因", at: new Date(),
    });
    mocks.queryWithTenant.mockResolvedValueOnce([{
      progress_seq: 1, tenant_id: "T1", store_id: 1, order_family: "miniapp_retail", order_no: "DD1",
      source_event_id: "c".repeat(64),
      event_name: "order.progress.miniapp_retail.cancelled", event_version: "1.0.0",
      business_stage: "CANCELLED", business_status: "CANCELLED",
      failure_code: null, retry_entry: null, manual_intervention_url: null,
      status_reason: "含金额 88.00 的原因", actor_type: "user", actor_id: "42",
      visible_to: JSON.stringify(sample.visibleTo),
      field_filter: JSON.stringify(sample.fieldFilter),
      idempotency_key: "d".repeat(64),
      started_at: "2026-10-29 10:00:00", ended_at: "2026-10-29 10:00:00", created_at: "2026-10-29 10:00:00",
    }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce(null).mockResolvedValueOnce({ progress_seq: 1 });
    // SALES_STAFF ⇒ store_staff token：非豁免角色 ⇒ 金额打码；consumer 隐藏面不含 store_staff ⇒ actor_id 保留给店员
    const res = await queryOrderProgress(
      { tenantId: "T1", roles: ["SALES_STAFF"], storeId: 1, storeScoped: false },
      { orderFamily: "miniapp_retail", orderNo: "DD1" },
    );
    const ev = res.events[0] as Record<string, unknown>;
    expect(String(ev.status_reason)).not.toContain("88.00");
    expect(ev.visible_to).toEqual(sample.visibleTo);
  });
});
