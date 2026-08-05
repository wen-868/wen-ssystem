/**
 * 订单超时 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/order-timeout.service.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/logger", () => ({
  default: { error: mocks.loggerError, info: mocks.loggerInfo, warn: vi.fn() },
}));

import {
  getConfigs,
  createConfig,
  updateConfig,
  deleteConfig,
  getLogs,
  getStatistics,
  getEnabledConfigs,
  processTimeoutConfig,
  startOrderTimeoutScanner,
} from "../../../services/admin/order-timeout.service";

const mockConn = { execute: vi.fn() };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (cb: (conn: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("order-timeout.service - 配置管理", () => {
  it("getConfigs 返回配置列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, orderType: "SALE" }]);
    const res = await getConfigs("t1");
    expect(res).toEqual([{ id: 1, orderType: "SALE" }]);
  });

  it("createConfig 成功，enabled 转 1/0，description 缺省为 null", async () => {
    mocks.queryWithTenant.mockResolvedValue({ insertId: 3 });
    const res = await createConfig("t1", {
      orderType: "SALE",
      timeoutType: "WAIT_PAY",
      timeoutMinutes: 30,
      action: "CANCEL",
      enabled: true,
    });
    expect(res).toEqual({ id: 3 });
    const params = mocks.queryWithTenant.mock.calls[0][1] as unknown[];
    expect(params).toContain(1);
    expect(params).toContain(null);
  });

  it("updateConfig 无字段时返回 false", async () => {
    const res = await updateConfig("t1", 1, {});
    expect(res).toBe(false);
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
  });

  it("updateConfig 部分字段更新返回 true", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await updateConfig("t1", 1, { timeoutMinutes: 60, enabled: false, action: "AUTO_ACCEPT" });
    expect(res).toBe(true);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("timeout_minutes = ?, action = ?, enabled = ?");
  });

  it("deleteConfig 执行删除", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]);
    await deleteConfig("t1", 1);
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("DELETE FROM t_order_timeout_config");
  });
});

describe("order-timeout.service - getLogs", () => {
  it("全部条件传入时拼接 WHERE", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ total: 2 });
    mocks.queryWithTenant.mockResolvedValue([{ id: 1 }]);
    const res = await getLogs("t1", { page: 1, pageSize: 10, result: "SUCCESS", dateStart: "2026-01-01", dateEnd: "2026-01-02" });
    expect(res.total).toBe(2);
    const sql = String(mocks.queryOneWithTenant.mock.calls[0][0]);
    expect(sql).toContain("otl.result = ?");
    expect(sql).toContain("otl.triggered_at >= ?");
    expect(sql).toContain("otl.triggered_at <= ?");
  });

  it("无条件时 WHERE 为空串", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await getLogs("t1", { page: 1, pageSize: 10, result: "", dateStart: "", dateEnd: "" });
    expect(res.total).toBe(0);
    expect(String(mocks.queryOneWithTenant.mock.calls[0][0])).not.toContain("WHERE");
  });
});

describe("order-timeout.service - getStatistics", () => {
  it("今日/本周/本月/成功/失败计数", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ count: 5 })
      .mockResolvedValueOnce({ count: 10 })
      .mockResolvedValueOnce({ count: 30 })
      .mockResolvedValueOnce({ count: 4 })
      .mockResolvedValueOnce(null);
    const res = await getStatistics("t1");
    expect(res).toEqual({
      today: 5,
      thisWeek: 10,
      thisMonth: 30,
      todaySuccess: 4,
      todayFailed: 0,
    });
  });
});

describe("order-timeout.service - getEnabledConfigs", () => {
  it("查询启用配置", async () => {
    mocks.query.mockResolvedValue([{ id: 1, order_type: "SALE" }]);
    const res = await getEnabledConfigs();
    expect(res).toEqual([{ id: 1, order_type: "SALE" }]);
    expect(String(mocks.query.mock.calls[0][0])).toContain("enabled = 1");
  });
});

describe("order-timeout.service - processTimeoutConfig", () => {
  const baseConfig = {
    id: 1,
    order_type: "SALE",
    timeout_type: "WAIT_PAY",
    timeout_minutes: 30,
    action: "CANCEL",
    tenant_id: 1,
  };

  it("未知订单类型/超时类型时直接返回不查询", async () => {
    await processTimeoutConfig({ ...baseConfig, order_type: "OTHER", timeout_type: "X" });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("SALE+WAIT_PAY+CANCEL 取消未支付订单并写成功日志", async () => {
    mocks.query.mockResolvedValueOnce([{ id: 100, order_no: "XS001" }]);
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    await processTimeoutConfig(baseConfig);
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(String(mocks.query.mock.calls[0][0])).toContain("miniapp_order");
    expect(String(mocks.query.mock.calls[0][0])).toContain("order_status = 'PENDING'");
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mockConn.execute).toHaveBeenCalledTimes(2);
    expect(String(mockConn.execute.mock.calls[0][0])).toContain("pay_status = 'CANCELLED'");
    expect(String(mockConn.execute.mock.calls[1][0])).toContain("INSERT INTO t_order_timeout_log");
  });

  it("SALE+WAIT_ACCEPT+AUTO_ACCEPT 自动接单", async () => {
    mocks.query.mockResolvedValueOnce([{ id: 101, order_no: "XS002" }]);
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    await processTimeoutConfig({ ...baseConfig, timeout_type: "WAIT_ACCEPT", action: "AUTO_ACCEPT" });
    expect(String(mockConn.execute.mock.calls[0][0])).toContain("order_status = 'ACCEPTED'");
  });

  it("SALE+WAIT_SIGN+AUTO_SIGN 自动签收", async () => {
    mocks.query.mockResolvedValueOnce([{ id: 102, order_no: "XS003" }]);
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    await processTimeoutConfig({ ...baseConfig, timeout_type: "WAIT_SIGN", action: "AUTO_SIGN" });
    expect(String(mockConn.execute.mock.calls[0][0])).toContain("delivery_status = 'DELIVERED'");
  });

  it("SALE+WAIT_SIGN+CANCEL 标记完成", async () => {
    mocks.query.mockResolvedValueOnce([{ id: 103, order_no: "XS004" }]);
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    await processTimeoutConfig({ ...baseConfig, timeout_type: "WAIT_SIGN", action: "CANCEL" });
    expect(String(mockConn.execute.mock.calls[0][0])).toContain("order_status = 'COMPLETED'");
  });

  it("PURCHASE+WAIT_CONFIRM+CANCEL 取消采购订单（else 分支）", async () => {
    mocks.query.mockResolvedValueOnce([{ id: 200, order_no: "CG001" }]);
    mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
    await processTimeoutConfig({ ...baseConfig, order_type: "PURCHASE", timeout_type: "WAIT_CONFIRM" });
    expect(String(mocks.query.mock.calls[0][0])).toContain("purchase_order");
    expect(String(mockConn.execute.mock.calls[0][0])).toContain("order_status = 'CANCELLED'");
  });

  it("事务失败时写 FAILED 日志", async () => {
    mocks.query.mockResolvedValueOnce([{ id: 104, order_no: "XS005" }]);
    mocks.transaction.mockRejectedValueOnce(new Error("db error"));
    mocks.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await processTimeoutConfig(baseConfig);
    expect(String(mocks.query.mock.calls[1][0])).toContain("'FAILED'");
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it("事务与失败日志写入都失败时记录 error 日志", async () => {
    mocks.query.mockResolvedValueOnce([{ id: 105, order_no: "XS006" }]);
    mocks.transaction.mockRejectedValueOnce(new Error("db error"));
    mocks.query.mockRejectedValueOnce(new Error("log insert failed"));
    await processTimeoutConfig(baseConfig);
    expect(mocks.loggerError).toHaveBeenCalled();
  });
});

describe("order-timeout.service - startOrderTimeoutScanner", () => {
  it("启动扫描器并防止重复启动", () => {
    vi.useFakeTimers();
    mocks.query.mockResolvedValue([]);
    startOrderTimeoutScanner();
    startOrderTimeoutScanner();
    vi.advanceTimersByTime(61000);
    expect(mocks.loggerInfo).toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalled();
  });
});
