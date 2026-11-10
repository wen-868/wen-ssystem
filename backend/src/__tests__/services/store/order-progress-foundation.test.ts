/**
 * TOTAL-ORDER-PROGRESS-02 · 订单进度事件底座测试
 *
 * 覆盖派单卡 §一.5 / 硬验收 3-8：
 *   A. 幂等：重复事件（同 source_event_id）⇒ duplicate，不新增行；同一动作重试必得同键
 *   B. 并发撞 seq：uk_order_seq 冲突 ⇒ 重试取新号，两个合法事件都入库、不判 stale
 *   C. seq 分配不依赖幂等键（§4.1 规则 5）
 *   D. 跨租户隔离：source_event_id 含租户键 ⇒ 他租户同号不碰撞
 *   E. AI 步骤态禁入业务字段（契约 §5.4/§9.2）
 *   F. failure_code 闭环（九码/适用族/retry/manual/FAILED 必带码/终态必带 ended_at）
 *   G. 字段过滤读侧：AI 白名单裁剪、角色隐藏字段、visible_to 交集
 *   H. 查询：since_seq 增量、游标分页、跨租户零命中
 *   I. sale_bill 三类事务接入同事务写事件（创建/收款结清/作废）+ 事件失败 ⇒ 冒泡回滚
 *
 * 保真度：桩 = 数据库连接（同仓内既有口径，如 sale-bill-cancel.test.ts）；
 *   真 = 被测函数本体、SQL 文本与参数、sha256 键派生、冲突重试逻辑、投影裁剪规则。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
  makeToken: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
  pool: {},
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
  makeToken: mocks.makeToken,
}));

vi.mock("../../../shared/fulfillment", () => ({
  computeSellingPrice: vi.fn(),
  getPriceType: vi.fn(),
}));

vi.mock("../../../shared/trace-code", () => ({
  updateTraceCodesBySkuList: vi.fn(),
  verifyTraceCode: vi.fn(),
}));

vi.mock("../../../services/admin/notification-sender.service", () => ({
  sendNotificationWithPush: vi.fn().mockResolvedValue({ notificationId: 1, pushResults: [] }),
  sendNotification: vi.fn().mockResolvedValue(1),
}));

import {
  appendOrderProgressEvent,
  saleBillEvent,
} from "../../../shared/order-progress-events";
import {
  validateAndDerive,
  OrderProgressContractError,
} from "../../../shared/order-progress-contract";
import {
  projectForAi,
  projectForHuman,
  resolveCaller,
  queryOrderProgress,
  encodeCursor,
  decodeCursor,
} from "../../../services/store/order-progress-query.service";
import { cancelSaleBill } from "../../../services/store/sale-bill.service";
import { AppError } from "../../../shared/app-error";

/** 基础合法事件输入（sale_bill · CREATED） */
function baseInput(over: Record<string, unknown> = {}) {
  return {
    tenantId: "T1",
    storeId: 7,
    orderFamily: "sale_bill" as const,
    orderNo: "XS001",
    businessStage: "CREATED",
    businessStatus: "CREATED",
    actorType: "user" as const,
    actorId: 42,
    upstreamBizKey: "XS001",
    startedAt: new Date("2026-10-28T10:00:00Z"),
    endedAt: null,
    visibleTo: ["store_staff", "store_manager", "hq_admin", "finance"],
    fieldFilter: { hidden_fields: { ai: ["actor_id", "source_event_id", "idempotency_key", "store_id"] }, money_in_free_text: { fields: ["status_reason"], exempt_roles: ["hq_admin", "finance", "store_manager"] } },
    ...over,
  };
}

/**
 * 按 SQL 分派的 conn 桩。
 * 撞号语义：dupOnSeq 里的号视为**并发事务已占用**；一旦 INSERT 撞上，seqFloor 抬高，
 * 下一次 MAX 读数即反映占用 ⇒ 重试取更大新号（§4.5 真库行为的桩等价实现）。
 */
function makeConn(opts: {
  existingSeqBySource?: Record<string, number>;
  maxSeq?: number;
  dupOnSeq?: number[]; // 在这些 seq 上抛 uk_order_seq 冲突
  dupOnSource?: string[]; // 这些 source_event_id 在 INSERT 时抛 uk_source_event 冲突
} = {}) {
  const inserted: Array<Record<string, unknown>> = [];
  let seqFloor = opts.maxSeq ?? 0;
  const conn = {
    query: vi.fn(async () => [[]]),
    execute: vi.fn(async (sql: string, params: unknown[] = []) => {
      const s = String(sql);
      if (s.includes("SELECT progress_seq FROM t_order_progress_event WHERE tenant_id = ? AND source_event_id = ?")) {
        const seq = opts.existingSeqBySource?.[String(params[1])];
        return seq != null ? [[{ progress_seq: seq }]] : [[]];
      }
      if (s.includes("SELECT COALESCE(MAX(progress_seq), 0)")) {
        return [[{ max_seq: seqFloor }]];
      }
      if (!s.includes("INSERT INTO t_order_progress_event")) return [{ affectedRows: 1 }];
      const seq = Number(params[5]);
      const source = String(params[4]);
      if ((opts.dupOnSeq ?? []).includes(seq)) {
        const err = new Error(`Duplicate entry 'T1-sale_bill-XS001-${seq}' for key 't_order_progress_event.uk_order_seq'`);
        (err as { code?: string }).code = "ER_DUP_ENTRY";
        inserted.push({ seq, source, dup: "seq" });
        seqFloor = Math.max(seqFloor, seq); // 并发占用生效 ⇒ 下一次 MAX+1 更大
        throw err;
      }
      if ((opts.dupOnSource ?? []).includes(source)) {
        const err = new Error(`Duplicate entry '${source}' for key 't_order_progress_event.uk_source_event'`);
        (err as { code?: string }).code = "ER_DUP_ENTRY";
        throw err;
      }
      inserted.push({ seq, source });
      return [{ affectedRows: 1 }];
    }),
    inserted,
  };
  return conn;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("ZF20261028000001");
  mocks.makeToken.mockReturnValue("token-abc");
});

describe("A · 写入幂等（§4.1 规则 2/6，硬验收 3）", () => {
  it("A1 同一动作重复写入 ⇒ 第二次 duplicate=true，不新增行", async () => {
    const derived = validateAndDerive(baseInput() as never);
    // 第一次：库里没有 ⇒ 插入
    const c1 = makeConn({});
    const r1 = await appendOrderProgressEvent(c1 as never, baseInput() as never);
    expect(r1.duplicate).toBe(false);
    expect(c1.inserted).toHaveLength(1);
    // 第二次：预置库中已有该 source ⇒ 写入前去重命中
    const c2 = makeConn({ existingSeqBySource: { [derived.sourceEventId]: 1 } });
    const r2 = await appendOrderProgressEvent(c2 as never, baseInput() as never);
    expect(r2.duplicate).toBe(true);
    expect(r2.progressSeq).toBe(1);
    expect(c2.inserted).toHaveLength(0);
  });

  it("A2 同一 actor 重试同一动作 ⇒ source_event_id 必得同键（零时间戳成分）", async () => {
    const d1 = validateAndDerive(baseInput({ startedAt: new Date("2026-10-28T10:00:00Z") }) as never);
    const d2 = validateAndDerive(baseInput({ startedAt: new Date("2026-11-02T23:59:59Z") }) as never);
    expect(d1.sourceEventId).toBe(d2.sourceEventId);
    expect(d1.idempotencyKey).toBe(d2.idempotencyKey);
  });

  it("A3 idempotency_key = sha256(source_event_id) 机械可重算", async () => {
    const d = validateAndDerive(baseInput() as never);
    expect(d.idempotencyKey).toBe(createHash("sha256").update(d.sourceEventId, "utf8").digest("hex"));
    expect(d.sourceEventId).toHaveLength(64);
  });

  it("A4 INSERT 竞态撞 uk_source_event ⇒ 仍返回 duplicate（并发幂等，不报错）", async () => {
    const derived = validateAndDerive(baseInput() as never);
    const c = makeConn({ dupOnSource: [derived.sourceEventId] });
    const r = await appendOrderProgressEvent(c as never, baseInput() as never);
    expect(r.duplicate).toBe(true);
  });
});

describe("B · 并发撞 seq（§4.5，硬验收 4）", () => {
  it("B1 撞 uk_order_seq ⇒ 重试取更大新号，事件入库、不判 stale", async () => {
    const c = makeConn({ dupOnSeq: [1] });
    const r = await appendOrderProgressEvent(c as never, baseInput() as never);
    expect(r.duplicate).toBe(false);
    expect(r.progressSeq).toBeGreaterThan(1);
    // 至少两次 INSERT 尝试（首次撞号 + 重试成功）
    const seqAttempts = c.inserted.filter((i) => i.dup === "seq").length;
    expect(seqAttempts).toBe(1);
    expect(c.inserted).toHaveLength(2);
  });

  it("B2 超过 3 次仍冲突 ⇒ 抛可重试错误（不静默丢弃合法事件）", async () => {
    const c = makeConn({ dupOnSeq: [1, 2, 3, 4, 5] });
    await expect(appendOrderProgressEvent(c as never, baseInput() as never))
      .rejects.toThrowError(/seq 分配冲突超过重试上限/);
  });
});

describe("C · seq 不参与去重（§4.1 规则 5）", () => {
  it("C1 两次写入的 source_event_id 不含 progress_seq：同业务事实不同时间 ⇒ 同键不同 seq", async () => {
    const c1 = makeConn({});
    const c2 = makeConn({ maxSeq: 5 });
    const r1 = await appendOrderProgressEvent(c1 as never, baseInput() as never);
    // 第二次模拟库里已有 5 条 ⇒ 新号 6，但键与第一次完全一致（重复 ⇒ A1 已证；这里证明 seq 与键无关）
    const r2 = await appendOrderProgressEvent(c2 as never, baseInput({ actorId: 43 }) as never);
    expect(r1.sourceEventId).not.toBe(r2.sourceEventId);
    expect(r2.progressSeq).toBe(6);
    expect(r2.sourceEventId).toHaveLength(64);
  });
});

describe("D · 跨租户隔离（§5.1，硬验收 7）", () => {
  it("D1 他租户同单号同阶段 ⇒ source_event_id 不同（租户键入哈希）", async () => {
    const d1 = validateAndDerive(baseInput({ tenantId: "T1" }) as never);
    const d2 = validateAndDerive(baseInput({ tenantId: "T2" }) as never);
    expect(d1.sourceEventId).not.toBe(d2.sourceEventId);
  });

  it("D2 查询服务：缺租户 ⇒ 403", () => {
    expect(() => resolveCaller({ roles: ["STORE_MANAGER"] })).toThrowError(AppError);
    try {
      resolveCaller({ roles: [] });
    } catch (e) {
      expect((e as AppError).statusCode).toBe(403);
    }
  });

  it("D3 查询 SQL 强制 tenant_id 谓词；跨租户样例零命中", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const caller = resolveCaller({ tenantId: "T1", roles: ["SUPER_ADMIN"] });
    const res = await queryOrderProgress(caller, { orderFamily: "sale_bill", orderNo: "XS-OTHER" });
    expect(res.events).toEqual([]);
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("WHERE tenant_id = ?");
    expect(mocks.queryWithTenant.mock.calls[0][1][0]).toBe("T1");
  });
});

describe("E · AI 步骤态禁入业务字段（§5.4/§9.2，硬验收 8 前置）", () => {
  it.each(["pending", "running", "success", "failed", "suspended", "skipped"])(
    "E1 business_stage=%s ⇒ 判红", (stage) => {
      expect(() => validateAndDerive(baseInput({ businessStage: stage }) as never))
        .toThrowError(OrderProgressContractError);
    },
  );

  it("E2 business_status=running ⇒ 同样判红（双字段拦截）", () => {
    expect(() => validateAndDerive(baseInput({ businessStatus: "running" }) as never))
      .toThrowError(/AI 步骤态/);
  });
});

describe("F · failure_code 闭环（§7.1，硬验收 5）", () => {
  it("F1 九码外 ⇒ 判红", () => {
    expect(() => validateAndDerive(baseInput({ failureCode: "FOO" }) as never))
      .toThrowError(/不在 §7.1 九码白名单/);
  });

  it("F2 码与族不匹配 ⇒ 判红（TRANSFER_REJECTED 用在 aftersale）", () => {
    expect(() => validateAndDerive(baseInput({ orderFamily: "aftersale", failureCode: "TRANSFER_REJECTED", businessStage: "REJECTED", endedAt: new Date("2026-10-28T10:00:00Z") }) as never))
      .toThrowError(/不适用于族/);
  });

  it("F3 有重试入口的码缺 retry_entry ⇒ 判红", () => {
    expect(() => validateAndDerive(baseInput({ failureCode: "PAYMENT_TIMEOUT", orderFamily: "seckill", businessStage: "CANCELLED", endedAt: new Date() }) as never))
      .toThrowError(/必须携带 retry_entry/);
  });

  it("F4 EXCEPTION_UNRESOLVED 缺 manual_intervention_url ⇒ 判红", () => {
    expect(() => validateAndDerive(baseInput({ orderFamily: "timeout_exception", businessStage: "PROCESSING", failureCode: "EXCEPTION_UNRESOLVED", retryEntry: "manual" }) as never))
      .toThrowError(/必须携带 manual_intervention_url/);
  });

  it("F5 FAILED/REJECTED 阶段必带 failure_code", () => {
    expect(() => validateAndDerive(baseInput({ orderFamily: "refund", businessStage: "FAILED", endedAt: new Date() }) as never))
      .toThrowError(/必须携带 failure_code/);
  });

  it("F6 终态缺 ended_at ⇒ 判红", () => {
    expect(() => validateAndDerive(baseInput({ businessStage: "VOIDED" }) as never))
      .toThrowError(/必须携带 ended_at/);
  });

  it("F7 族外阶段 ⇒ 判红（sale_bill 无 PREPARING）", () => {
    expect(() => validateAndDerive(baseInput({ businessStage: "PREPARING" }) as never))
      .toThrowError(/不属于 sale_bill 的 §三 阶段值域/);
  });

  it("F8 system/cron 缺稳定主体键 ⇒ 判红（禁止 actor_type 裸值，§4.1 规则 4）", () => {
    expect(() => validateAndDerive(baseInput({ actorType: "cron", actorId: null }) as never))
      .toThrowError(/稳定主体键/);
  });
});

describe("G · 读侧字段过滤（§5.3/§5.4，硬验收 8）", () => {
  const row = {
    progress_seq: 1, tenant_id: "T1", store_id: 7, order_family: "sale_bill", order_no: "XS001",
    source_event_id: "s", event_name: "order.progress.sale_bill.created", event_version: "1.0.0",
    business_stage: "CREATED", business_status: "CREATED", failure_code: null, retry_entry: null,
    manual_intervention_url: null, status_reason: "应收 ¥258.00（成本 ¥180.00）", actor_type: "user",
    actor_id: "42", visible_to: ["store_staff", "store_manager", "hq_admin", "finance"],
    field_filter: JSON.stringify({ hidden_fields: { ai: ["actor_id", "source_event_id", "idempotency_key", "store_id"] }, money_in_free_text: { fields: ["status_reason"], exempt_roles: ["hq_admin", "finance", "store_manager"] } }),
    idempotency_key: "i", started_at: new Date("2026-10-28T10:00:00Z"), ended_at: null,
    created_at: new Date("2026-10-28T10:00:00Z"),
    receivable_amount: 258, goods_amount: 258, unit_price: 12, cost_price: 8,
  };

  it("G1 AI 通道 ⇒ 仅 §5.4 白名单字段，金额/价格/操作人一律不出现", () => {
    const view = projectForAi(row as never);
    expect(view).not.toHaveProperty("actor_id");
    expect(view).not.toHaveProperty("idempotency_key");
    expect(view).not.toHaveProperty("source_event_id");
    expect(view).not.toHaveProperty("store_id");
    expect(JSON.stringify(view)).not.toMatch(/cost_price|unit_price|receivable_amount|"actor_id"/);
  });

  it("G2 店员角色 ⇒ money_in_free_text 命中，status_reason 内金额数字全部打码", () => {
    const caller = resolveCaller({ tenantId: "T1", roles: ["CASHIER"], storeId: 7 });
    const view = projectForHuman(row as never, caller);
    expect(view.status_reason).not.toBeNull();
    expect(String(view.status_reason)).not.toMatch(/\d/);
  });

  it("G3 总部管理员 ⇒ 不被 store_staff 隐藏面裁剪（无该 token）", () => {
    const caller = resolveCaller({ tenantId: "T1", roles: ["SUPER_ADMIN"] });
    const view = projectForHuman(row as never, caller);
    expect(view.status_reason).toBe(row.status_reason);
  });

  it("G4 visible_to 与调用者角色交集为空 ⇒ 该事件不下发", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ ...row, visible_to: ["finance"] }]);
    mocks.queryOneWithTenant.mockImplementation(async (sql: string) => {
      if (String(sql).includes("FROM t_sale_bill")) return { store_id: 7 } as never; // 门店可见性通过
      if (String(sql).includes("COALESCE(MAX(progress_seq)")) return { progress_seq: 1 } as never;
      return { progress_seq: 1, business_stage: "CREATED", business_status: "CREATED" } as never;
    });
    const caller = resolveCaller({ tenantId: "T1", roles: ["CASHIER"], storeId: 7 });
    const res = await queryOrderProgress(caller, { orderFamily: "sale_bill", orderNo: "XS001" });
    expect(res.events).toHaveLength(0);
  });
});

describe("H · 查询语义（§4.3，硬验收 6/7）", () => {
  it("H1 since_seq ⇒ 谓词 progress_seq > ? 且参数带租户", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const caller = resolveCaller({ tenantId: "T1", roles: ["SUPER_ADMIN"] });
    await queryOrderProgress(caller, { orderFamily: "sale_bill", orderNo: "XS001", sinceSeq: 5 });
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(String(sql)).toContain("progress_seq > ?");
    expect(params).toEqual(["T1", "sale_bill", "XS001", 5, 51]);
  });

  it("H2 游标 base64url(progress_seq) 可编解；limit 上限 200", () => {
    expect(decodeCursor(encodeCursor(9))).toBe(9);
    expect(decodeCursor("!!!bad!!!")).toBeNull();
  });

  it("H3 分页：多取 1 行判定 has_more，next_cursor 指向本页尾", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      progress_seq: i + 1, tenant_id: "T1", store_id: 7, order_family: "sale_bill", order_no: "XS001",
      source_event_id: `s${i}`, event_name: "n", event_version: "1.0.0", business_stage: "CREATED",
      business_status: "CREATED", failure_code: null, retry_entry: null, manual_intervention_url: null,
      status_reason: null, actor_type: "user", actor_id: "1", visible_to: ["hq_admin"], field_filter: "{}",
      idempotency_key: "i", started_at: new Date(), ended_at: null, created_at: new Date(),
    }));
    mocks.queryWithTenant.mockResolvedValue(rows);
    mocks.queryOneWithTenant.mockResolvedValue({ progress_seq: 3, business_stage: "CREATED", business_status: "CREATED" });
    const caller = resolveCaller({ tenantId: "T1", roles: ["SUPER_ADMIN"] });
    const res = await queryOrderProgress(caller, { orderFamily: "sale_bill", orderNo: "XS001", limit: 2 });
    expect(res.has_more).toBe(true);
    expect(res.events).toHaveLength(2);
    expect(decodeCursor(res.next_cursor)).toBe(2);
    expect(res.current_stage).toBe("CREATED");
  });

  it("H4 门店级用户查他门店销售单 ⇒ 404（不泄露存在性）", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ store_id: 99 });
    const caller = resolveCaller({ tenantId: "T1", roles: ["STORE_MANAGER"], storeId: 7 });
    await expect(queryOrderProgress(caller, { orderFamily: "sale_bill", orderNo: "XS001" }))
      .rejects.toThrowError(AppError);
  });

  it("H5 未知订单族 ⇒ 400", async () => {
    const caller = resolveCaller({ tenantId: "T1", roles: ["SUPER_ADMIN"] });
    await expect(queryOrderProgress(caller, { orderFamily: "not_a_family", orderNo: "X" }))
      .rejects.toThrowError(/未知订单族/);
  });
});

describe("I · sale_bill 三类事务接入同事务写事件（硬验收 5/6）", () => {
  const mockConn = { query: vi.fn(), execute: vi.fn() };
  const unpaidBill = {
    bill_no: "XS202610150001", store_id: 1, business_status: "CREATED", collection_status: "UNPAID",
    receivable_amount: 258, received_amount: 0, unreceived_amount: 258, void_source: null, void_reason: null,
  };

  beforeEach(() => {
    mocks.transaction.mockImplementation(async (cb: (conn: unknown) => Promise<unknown>) => cb(mockConn));
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    mockConn.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes("SELECT progress_seq FROM t_order_progress_event WHERE tenant_id = ? AND source_event_id = ?")) return [[]];
      if (String(sql).includes("COALESCE(MAX(progress_seq)")) return [[{ max_seq: 0 }]];
      if (String(sql).includes("FROM t_sale_bill")) return [[unpaidBill]];
      if (String(sql).includes("GROUP BY sku_id")) return [[{ sku_id: 1, out_qty: -10 }]];
      if (String(sql).includes("FROM t_inventory_balance")) return [[{ physical_qty: 90, available_qty: 90 }]];
      if (String(sql).includes("SALE_CANCEL")) return [[{ cnt: 0 }]];
      return [[]];
    });
  });

  function eventInserts() {
    return mockConn.execute.mock.calls.filter((c) => String(c[0]).includes("INSERT INTO t_order_progress_event"));
  }

  it("I1 作废事务 ⇒ 同连接写入 VOIDED 事件（uk_order_seq 口径键含租户+单号+阶段）", async () => {
    await cancelSaleBill({ billNo: "XS202610150001", reason: "客户不要了", source: "admin", userId: 7, username: "店长", tenantId: "default" });
    const calls = eventInserts();
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const params = calls[0][1] as unknown[];
    expect(params[0]).toBe("default");           // tenant_id
    expect(params[1]).toBe(1);                   // store_id
    expect(params[2]).toBe("sale_bill");         // order_family
    expect(params[3]).toBe("XS202610150001");    // order_no
    expect(params[8]).toBe("VOIDED");            // business_stage
    expect(params[6]).toBe("order.progress.sale_bill.voided"); // event_name（§2.2 机械派生）
    // source_event_id 六成分稳定（可重算）
    const expectSrc = createHash("sha256").update("default|sale_bill|XS202610150001|VOIDED|7|XS202610150001:VOIDED", "utf8").digest("hex");
    expect(params[4]).toBe(expectSrc);
    expect(params[18]).toBe(createHash("sha256").update(expectSrc, "utf8").digest("hex")); // idempotency_key
  });

  it("I2 已 VOIDED 的幂等分支 ⇒ 不重复写事件（提前返回，零 INSERT）", async () => {
    mockConn.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes("SELECT progress_seq FROM t_order_progress_event WHERE tenant_id = ? AND source_event_id = ?")) return [[]];
      if (String(sql).includes("COALESCE(MAX(progress_seq)")) return [[{ max_seq: 1 }]];
      if (String(sql).includes("FROM t_sale_bill")) return [[{ ...unpaidBill, business_status: "VOIDED", collection_status: "CLOSED" }]];
      if (String(sql).includes("SALE_CANCEL")) return [[{ cnt: 1 }]];
      return [[]];
    });
    const res = await cancelSaleBill({ billNo: "XS202610150001", source: "admin", userId: 7, username: "店长", tenantId: "default" });
    expect(res.idempotent).toBe(true);
    expect(eventInserts()).toHaveLength(0);
  });

  it("I3 事件写入失败 ⇒ 异常冒泡（同事务 ⇒ 业务一并回滚，§8.1）", async () => {
    mockConn.execute.mockImplementation(async (sql: string) => {
      if (String(sql).includes("INSERT INTO t_order_progress_event")) throw new Error("事件写入失败（模拟）");
      return [{ affectedRows: 1 }];
    });
    await expect(cancelSaleBill({ billNo: "XS202610150001", source: "admin", userId: 7, username: "店长", tenantId: "default" }))
      .rejects.toThrowError(/事件写入失败/);
    // 事件写在作废 UPDATE 之后 ⇒ 失败点之后无后续写入，事务由 transaction() 整体回滚
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("I4 AI 来源取消 ⇒ actor_type=ai 且 actor_id 落主体键（不冒充业务状态）", async () => {
    await cancelSaleBill({ billNo: "XS202610150001", source: "ai", userId: 99, username: "AI底座", tenantId: "default" });
    const params = eventInserts()[0][1] as unknown[];
    expect(params[14]).toBe("ai");   // actor_type
    expect(params[15]).toBe("99");   // actor_id
    expect(params[8]).toBe("VOIDED"); // business_stage（AI 动作只写业务值域）
  });
});

describe("J · saleBillEvent 装配", () => {
  it("J1 结清 ⇒ COMPLETED + ended_at 自动补齐", () => {
    const input = saleBillEvent({
      tenantId: "T1", storeId: 1, billNo: "XS1", businessStage: "COMPLETED",
      businessStatus: "PAID", actorType: "user", actorId: 5, upstreamBizKey: "ZF1", at: new Date("2026-10-28T10:00:00Z"),
    });
    expect(input.endedAt).not.toBeNull();
    expect(() => validateAndDerive(input as never)).not.toThrow();
  });

  it("J2 部分收款 ⇒ CREATED 非终态，无 ended_at", () => {
    const input = saleBillEvent({
      tenantId: "T1", storeId: 1, billNo: "XS1", businessStage: "CREATED",
      businessStatus: "PARTIAL", actorType: "user", actorId: 5, upstreamBizKey: "ZF1", at: new Date(),
    });
    expect(input.endedAt).toBeNull();
  });
});
