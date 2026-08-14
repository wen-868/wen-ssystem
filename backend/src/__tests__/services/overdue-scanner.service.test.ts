import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: mocks.query,
}));
vi.mock("../../shared/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { scanOverdueCreditBills, startOverdueScanner } from "../../services/overdue-scanner.service";

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("overdue-scanner.service - 超期赊销检测", () => {
  it("指定租户时只扫描该租户并返回影响行数", async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 3 }]);
    const affected = await scanOverdueCreditBills("t1");
    expect(affected).toBe(3);
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("collection_status = 'OVERDUE'");
    expect(sql).toContain("sale_type = 'CREDIT'");
    expect(sql).toContain("due_date < CURDATE()");
    expect(params).toEqual(["t1"]);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("未指定租户时扫描全部启用租户", async () => {
    mocks.query
      .mockResolvedValueOnce([{ tenant_id: "t1" }, { tenant_id: "t2" }]) // 租户列表
      .mockResolvedValueOnce([{ affectedRows: 2 }])
      .mockResolvedValueOnce([{ affectedRows: 5 }]);
    const affected = await scanOverdueCreditBills();
    expect(affected).toBe(7);
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.query.mock.calls[1][1]).toEqual(["t1"]);
    expect(mocks.query.mock.calls[2][1]).toEqual(["t2"]);
  });

  it("无超期单时返回 0 且不报错", async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 0 }]);
    const affected = await scanOverdueCreditBills("t1");
    expect(affected).toBe(0);
  });

  it("startOverdueScanner 启动定时任务并返回清理函数", async () => {
    vi.useFakeTimers();
    mocks.query.mockResolvedValue([{ affectedRows: 0 }]);
    const stop = startOverdueScanner();
    expect(typeof stop).toBe("function");
    stop();
    expect(mocks.query).toHaveBeenCalled(); // 启动时执行一次全量扫描
  });
});
