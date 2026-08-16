import { vi, describe, it, beforeEach, afterEach, expect } from "vitest";

const h = vi.hoisted(() => ({
  queryMock: vi.fn(),
  transactionMock: vi.fn(),
  loggerMock: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  conn: { execute: vi.fn() },
}));

vi.mock("@shared/db", () => ({
  query: h.queryMock,
  queryOne: vi.fn(),
  transaction: h.transactionMock,
}));

vi.mock("@shared/logger", () => ({
  default: h.loggerMock,
}));

import { startStoreControlScheduler } from "@shared/store-control-scheduler";

let orderCount = 0;
let totalAmount = 0;

function setupQuery(tenants: any[], configs: any[]) {
  h.queryMock.mockImplementation(async (sql: string, _params?: any[]) => {
    if (sql.includes("DISTINCT tenant_id")) return tenants;
    if (sql.includes("JOIN t_store s")) return configs;
    return [];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  orderCount = 0;
  totalAmount = 0;
  h.conn.execute.mockImplementation(async (sql: string, _params?: any[]) => {
    const s = String(sql).toUpperCase();
    if (s.includes("COUNT(*) AS ORDER_COUNT")) return [[{ order_count: orderCount }]];
    if (s.includes("COALESCE(SUM(RECEIVABLE_AMOUNT)")) return [[{ total_amount: totalAmount }]];
    return [{ affectedRows: 1 }];
  });
  h.transactionMock.mockImplementation(async (fn: any) => fn(h.conn));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("store-control-scheduler", () => {
  it("startStoreControlScheduler 启动定时检查器", async () => {
    vi.useFakeTimers();
    startStoreControlScheduler();
    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(h.loggerMock.info).toHaveBeenCalledWith(expect.stringContaining("定时检查器已启动"));
  });

  it("无租户配置时直接返回，不开启事务", async () => {
    setupQuery([], []);
    vi.useFakeTimers();
    startStoreControlScheduler();
    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(h.transactionMock).not.toHaveBeenCalled();
  });

  it("租户存在但无门店配置 → 跳过（continue 分支，不开启事务）", async () => {
    setupQuery([{ tenant_id: "t1" }], []);
    vi.useFakeTimers();
    startStoreControlScheduler();
    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(h.transactionMock).not.toHaveBeenCalled();
    expect(h.conn.execute).not.toHaveBeenCalled();
  });

  it("触发自动开门/关门/订单数上限/金额上限", async () => {
    setupQuery(
      [{ tenant_id: "t1" }],
      [
        { store_id: 1, current_status: "CLOSED", auto_open_time: "00:00", auto_close_time: "23:59", store_name: "A店" },
        { store_id: 2, current_status: "OPEN", auto_close_time: "00:00", max_daily_orders: 5, max_order_amount: 1000, store_name: "B店" },
      ]
    );
    orderCount = 10;
    totalAmount = 5000;
    vi.useFakeTimers();
    startStoreControlScheduler();
    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(h.transactionMock).toHaveBeenCalled();
    expect(h.conn.execute).toHaveBeenCalled();
    expect(h.loggerMock.info).toHaveBeenCalledWith(expect.stringContaining("自动开门"));
    expect(h.loggerMock.info).toHaveBeenCalledWith(expect.stringContaining("自动关门"));
  });

  it("未达上限时不触发上限关门（内层 false 分支）", async () => {
    setupQuery(
      [{ tenant_id: "t1" }],
      [{ store_id: 3, current_status: "OPEN", auto_close_time: "00:00", max_daily_orders: 5, max_order_amount: 1000, store_name: "C店" }]
    );
    orderCount = 0;
    totalAmount = 0;
    vi.useFakeTimers();
    startStoreControlScheduler();
    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(h.transactionMock).toHaveBeenCalled();
    expect(h.loggerMock.info).toHaveBeenCalledWith(expect.stringContaining("自动关门"));
  });
});
