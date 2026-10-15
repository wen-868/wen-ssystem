/**
 * S3-209 · 销售单取消（cancelSaleBill）单元测试
 *
 * 被测文件：src/services/store/sale-bill.service.ts
 * 派单卡：docs/tasks/inbox/ACTIVE-S3-209.md（§三.1 正常取消 / §三.2 幂等 /
 *   §三.3 状态拒绝 / §三.4 原子性 / §三.6 租户隔离 / §三.7 source 落库）
 *
 * 保真度：真 = 被测函数本体、SQL 文本与参数、AppError 状态码、事务包裹语义；
 *   桩 = 数据库连接（`transaction` 直接回调 mockConn，不连真库 —— 真库真 HTTP 见
 *   `docs/evidence/S3-209/harness.mjs`）。
 *
 * 反测（门禁铁律）：把 `cancelSaleBill` 里 `if (bill.business_status === "VOIDED")` 的幂等分支摘掉
 *   ⇒「重复取消只回滚一次」用例必红（第二次会再次写库存与流水）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { cancelSaleBill } from "../../../services/store/sale-bill.service";
import { AppError } from "../../../shared/app-error";

const mockConn = { query: vi.fn(), execute: vi.fn() };

/** 取消前的销售单行（UNPAID，未出库/已出库由用例各自的流水决定） */
const unpaidBill = {
  bill_no: "XS202610150001",
  store_id: 1,
  business_status: "CREATED",
  collection_status: "UNPAID",
  receivable_amount: 258,
  received_amount: 0,
  unreceived_amount: 258,
  void_source: null,
  void_reason: null,
};

/** 按 SQL 分派的 conn.query 桩：返回 [rows]（与 mysql2 解构口径一致） */
function dispatch(overrides: {
  bill?: unknown;
  outs?: unknown[];
  balances?: unknown[];
  cancelLedgerCount?: number;
}) {
  mockConn.query.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM t_sale_bill")) return [overrides.bill === undefined ? [unpaidBill] : overrides.bill];
    if (sql.includes("GROUP BY sku_id")) return [overrides.outs ?? [{ sku_id: 1, out_qty: -10 }]];
    if (sql.includes("FROM t_inventory_balance")) return [overrides.balances ?? [{ physical_qty: 90, available_qty: 90 }]];
    if (sql.includes("SALE_CANCEL")) return [[{ cnt: overrides.cancelLedgerCount ?? 0 }]];
    return [[]];
  });
}

/** 过滤出某类 execute 调用 */
function execCalls(fragment: string) {
  return mockConn.execute.mock.calls.filter((c) => String(c[0]).includes(fragment));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("IL20261015000001");
  mocks.makeToken.mockReturnValue("token-abc");
  mocks.transaction.mockImplementation(async (cb: (conn: unknown) => Promise<unknown>) => cb(mockConn));
  mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
});

describe("cancelSaleBill · 正常取消（§三.1）", () => {
  it("UNPAID + 已出库 10 瓶 ⇒ 作废 VOIDED/CLOSED + 库存回滚 10（真值 90 → 100）", async () => {
    dispatch({});
    const res = await cancelSaleBill({
      billNo: "XS202610150001",
      reason: "客户不要了",
      source: "admin",
      userId: 7,
      username: "店长",
      tenantId: "default",
    });

    expect(res).toMatchObject({
      billNo: "XS202610150001",
      status: "CANCELLED",
      businessStatus: "VOIDED",
      collectionStatus: "CLOSED",
      reversedStock: true,
      reversedItems: [{ skuId: 1, quantity: 10 }],
      idempotent: false,
      source: "admin",
    });

    // 库存回滚：改前 90 ⇒ 改后 100（+10）
    const inc = execCalls("physical_qty = physical_qty + ?");
    expect(inc).toHaveLength(1);
    expect(inc[0][1]).toEqual([10, 10, 1, 1, "default"]);
    // 回滚流水：biz_type = SALE_CANCEL、change_qty 为正、幂等键含单号与 SKU
    const ledger = execCalls("'SALE_CANCEL'");
    expect(ledger).toHaveLength(1);
    expect(ledger[0][1][0]).toBe("IL20261015000001");
    expect(String(ledger[0][1][8])).toBe("SALE_CANCEL:XS202610150001:1");
    // 作废 + 收款状态收口
    const upd = execCalls("SET business_status = 'VOIDED'");
    expect(upd).toHaveLength(1);
    expect(upd[0][1]).toEqual(["客户不要了", "admin", "XS202610150001", "default"]);
    // 操作日志（module/action + 来源）
    const log = execCalls("'SALE_BILL', 'CANCEL'");
    expect(log).toHaveLength(1);
    expect(String(log[0][1][4])).toContain('"source":"admin"');
  });

  it("PARTIAL（部分收款，本库既有取值）⇒ 同样可取消", async () => {
    dispatch({ bill: [{ ...unpaidBill, collection_status: "PARTIAL", received_amount: 100 }] });
    const res = await cancelSaleBill({
      billNo: "XS202610150001",
      source: "admin",
      userId: 7,
      username: "店长",
      tenantId: "default",
    });
    expect(res.status).toBe("CANCELLED");
  });

  it("未出库的单（无 SALE_OUT 流水）⇒ 状态照作废，但 reversedStock=false 且库存零改动", async () => {
    dispatch({ outs: [] });
    const res = await cancelSaleBill({
      billNo: "XS202610150001",
      source: "admin",
      userId: 7,
      username: "店长",
      tenantId: "default",
    });
    expect(res.reversedStock).toBe(false);
    expect(res.reversedItems).toEqual([]);
    expect(execCalls("physical_qty = physical_qty + ?")).toHaveLength(0);
    expect(execCalls("'SALE_CANCEL'")).toHaveLength(0);
    expect(execCalls("SET business_status = 'VOIDED'")).toHaveLength(1);
  });
});

describe("cancelSaleBill · 幂等（§三.2 重复取消只回滚一次）", () => {
  it("已 VOIDED ⇒ 返回既有结果，且**不再**写库存 / 不再写流水 / 不再改单", async () => {
    dispatch({ bill: [{ ...unpaidBill, business_status: "VOIDED", collection_status: "CLOSED", void_source: "ai", void_reason: "AI 取消" }], cancelLedgerCount: 1 });
    const res = await cancelSaleBill({
      billNo: "XS202610150001",
      source: "admin",
      userId: 7,
      username: "店长",
      tenantId: "default",
    });

    expect(res).toMatchObject({
      status: "CANCELLED",
      businessStatus: "VOIDED",
      reversedStock: true,
      idempotent: true,
      source: "ai",        // 返回**既有**来源，不被本次调用的来源覆盖
      reason: "AI 取消",
    });
    expect(res.reversedItems).toEqual([]);
    // 关键：库存与流水零写入（重复取消不会二次回滚）
    expect(execCalls("physical_qty = physical_qty + ?")).toHaveLength(0);
    expect(execCalls("'SALE_CANCEL'")).toHaveLength(0);
    expect(execCalls("SET business_status = 'VOIDED'")).toHaveLength(0);
    // 连出库流水都不查（幂等分支提前返回）
    const groupBySql = mockConn.query.mock.calls.map((c) => String(c[0])).filter((s) => s.includes("GROUP BY sku_id"));
    expect(groupBySql).toHaveLength(0);
  });
});

describe("cancelSaleBill · 状态拒绝（§三.3）", () => {
  it("PAID（已结清）⇒ AppError 400 + 可读文案，且不落任何改动", async () => {
    dispatch({ bill: [{ ...unpaidBill, collection_status: "PAID", received_amount: 258, unreceived_amount: 0 }] });
    await expect(
      cancelSaleBill({ billNo: "XS202610150001", source: "admin", userId: 7, username: "店长", tenantId: "default" })
    ).rejects.toThrowError(/已结清，不能直接取消，需走冲销流程/);
    try {
      await cancelSaleBill({ billNo: "XS202610150001", source: "admin", userId: 7, username: "店长", tenantId: "default" });
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(400);
    }
    expect(mockConn.execute).not.toHaveBeenCalled();
  });

  it("RETURNED（已退货）⇒ 400（再取消会把库存二次加回）", async () => {
    dispatch({ bill: [{ ...unpaidBill, business_status: "RETURNED" }] });
    await expect(
      cancelSaleBill({ billNo: "XS202610150001", source: "admin", userId: 7, username: "店长", tenantId: "default" })
    ).rejects.toThrowError(/已退货，不能取消/);
    expect(mockConn.execute).not.toHaveBeenCalled();
  });

  it("域外收款状态（如 OVERDUE 之外的取值）⇒ 400 且文案带真实取值", async () => {
    dispatch({ bill: [{ ...unpaidBill, collection_status: "SHARED" }] });
    await expect(
      cancelSaleBill({ billNo: "XS202610150001", source: "admin", userId: 7, username: "店长", tenantId: "default" })
    ).rejects.toThrowError(/SHARED/);
  });
});

describe("cancelSaleBill · 租户隔离（§三.6）", () => {
  it("本租户查不到该单（别租户的单）⇒ 404，不泄露存在性，零写入", async () => {
    dispatch({ bill: [] });
    await expect(
      cancelSaleBill({ billNo: "XS-B-OTHER", source: "ai", userId: 9, username: "AI", tenantId: "default" })
    ).rejects.toThrowError(/销售单不存在/);
    expect(mockConn.execute).not.toHaveBeenCalled();
    // 显式租户谓词（不依赖隐式注入）
    const selectSql = String(mockConn.query.mock.calls[0][0]);
    expect(selectSql).toContain("bill_no = ? AND tenant_id = ?");
    expect(mockConn.query.mock.calls[0][1]).toEqual(["XS-B-OTHER", "default"]);
  });
});

describe("cancelSaleBill · 原子性（§三.4）", () => {
  it("库存回滚中途失败 ⇒ 异常冒泡（事务由 transaction 包裹，整体回滚）", async () => {
    dispatch({});
    mockConn.execute.mockImplementation(async (sql: string) => {
      if (String(sql).includes("INSERT INTO t_inventory_ledger")) throw new Error("插流水失败（模拟）");
      return [{ affectedRows: 1 }];
    });
    await expect(
      cancelSaleBill({ billNo: "XS202610150001", source: "admin", userId: 7, username: "店长", tenantId: "default" })
    ).rejects.toThrowError(/插流水失败/);
    // 失败点之后的语句不再执行（单未被置 VOIDED）
    expect(execCalls("SET business_status = 'VOIDED'")).toHaveLength(0);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("取单即加锁（FOR UPDATE），并在事务内执行（同一连接）", async () => {
    dispatch({});
    await cancelSaleBill({ billNo: "XS202610150001", source: "admin", userId: 7, username: "店长", tenantId: "default" });
    expect(String(mockConn.query.mock.calls[0][0])).toContain("FOR UPDATE");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
});

describe("cancelSaleBill · source 落库（§三.7）", () => {
  it("source='ai' ⇒ void_source 与操作日志均为 ai", async () => {
    dispatch({});
    await cancelSaleBill({ billNo: "XS202610150001", source: "ai", userId: 99, username: "AI底座", tenantId: "default" });
    const upd = execCalls("SET business_status = 'VOIDED'");
    expect(upd[0][1][1]).toBe("ai");
    const log = execCalls("'SALE_BILL', 'CANCEL'");
    // 参数序：userId, username, billNo, before_data, after_data, tenantId ⇒ after_data 在下标 4
    expect(String(log[0][1][4])).toContain('"source":"ai"');
    expect(log[0][1][1]).toBe("AI底座");
  });

  it("缺省 admin（同一次用例集覆盖两态）⇒ void_source=admin", async () => {
    dispatch({});
    await cancelSaleBill({ billNo: "XS202610150001", source: "admin", userId: 7, username: "店长", tenantId: "default" });
    expect(execCalls("SET business_status = 'VOIDED'")[0][1][1]).toBe("admin");
  });
});
