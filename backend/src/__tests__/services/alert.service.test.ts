/**
 * 预警引擎 service 单元测试
 * 被测文件：src/services/alert.service.ts
 *
 * 覆盖范围：
 *  - runAllAlertChecks：全规则命中生成预警（覆盖 5 类 check* 内部函数与入库逻辑）
 *                      / 无租户参数时遍历所有活跃租户（覆盖 getAllActiveTenants）
 *                      / 各规则未启用时提前返回 0
 *  - listAlerts：无筛选 / 多筛选条件拼接 / total 兜底 0
 *  - getAlertCounts：按类型·级别聚合计数（pending/handled/ignored）
 *  - handleAlert：404 不存在 / 400 已处理 / HANDLE→HANDLED / 非 HANDLE→IGNORED / username 缺省 system
 *  - listAlertRules：返回规则列表
 *  - updateAlertRule：404 不存在 / 全字段更新 / 无更新字段仅返回规则
 *  - runCheck：包装 runAllAlertChecks 返回完成消息
 *  - startAlertScheduler：启动定时检查不抛异常
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../shared/db", () => ({
  query: mocks.query,
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));
vi.mock("../../shared/logger", () => ({ default: mocks.logger }));
vi.mock("../../shared/id", () => ({ makeBizNo: mocks.makeBizNo }));

import {
  runAllAlertChecks,
  listAlerts,
  getAlertCounts,
  handleAlert,
  listAlertRules,
  updateAlertRule,
  runCheck,
  startAlertScheduler,
} from "../../services/alert.service";

const mockConn = {
  query: vi.fn().mockResolvedValue([[], []]),
  execute: vi.fn().mockResolvedValue({}),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.makeBizNo.mockReturnValue("YJ2026081500001");
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
});

describe("alert.service - runAllAlertChecks", () => {
  it("全规则命中并生成预警（覆盖 5 类 check* 入库逻辑）", async () => {
    mocks.queryOneWithTenant.mockImplementation(async (sql: string) => {
      if (sql.includes("rule_code = 'STOCK_LOW'")) return { id: 1, rule_type: "STOCK_LOW", threshold_value: 10, enabled: 1 };
      if (sql.includes("rule_code = 'CREDIT_LIMIT'")) return { id: 2, rule_type: "CREDIT", threshold_value: 80, enabled: 1 };
      if (sql.includes("rule_code = 'PAYMENT_OVERDUE'")) return { id: 3, rule_type: "OVERDUE", threshold_value: 0, enabled: 1 };
      if (sql.includes("rule_code = 'STOCK_OVERSTOCK'")) return { id: 4, rule_type: "STOCK_OVERSTOCK", threshold_value: 30, enabled: 1 };
      return null;
    });
    mocks.queryWithTenant.mockImplementation(async (sql: string) => {
      if (sql.includes("rule_type = 'EXPIRY'") && sql.includes("t_alert_rule")) return [{ id: 5, rule_type: "EXPIRY", threshold_value: 7, enabled: 1 }];
      if (sql.includes("t_inventory_balance ib")) return [{ storeId: 1, skuId: 101, skuName: "商品A", availableQty: 3, safetyStock: 10 }];
      if (sql.includes("remainingDays")) return [{ skuId: 102, skuName: "商品B", batchNo: "BN001", expiryDate: "2026-09-01", qty: 5, remainingDays: 3 }];
      if (sql.includes("ageDays")) return [{ skuId: 103, skuName: "商品C", batchNo: "BN002", qty: 8, inStockDate: "2026-01-01", ageDays: 60 }];
      if (sql.includes("totalDebt")) return [{ customerId: 201, customerName: "客户甲", totalDebt: 1000 }];
      if (sql.includes("overdueDays")) return [{ billNo: "B001", customerId: 301, customerName: "客户乙", receivableAmount: 500, receivedAmount: 0, unreceivedAmount: 500, dueDate: "2026-01-01", overdueDays: 10 }];
      return [];
    });

    const res = await runAllAlertChecks("t1");
    expect(res.total).toBe(5);
    expect(res.stockLow).toBe(1);
    expect(res.expiry).toBe(1);
    expect(res.credit).toBe(1);
    expect(res.overdue).toBe(1);
    expect(res.overstock).toBe(1);
  });

  it("覆盖各 check 的 CRITICAL 等级判定与 creditLimit<=0 跳过分支", async () => {
    mocks.queryOneWithTenant.mockImplementation(async (sql: string) => {
      if (sql.includes("rule_code = 'STOCK_LOW'")) return { id: 1, rule_type: "STOCK_LOW", threshold_value: 10, enabled: 1 };
      if (sql.includes("rule_code = 'CREDIT_LIMIT'")) return { id: 2, rule_type: "CREDIT", threshold_value: 80, enabled: 1 };
      if (sql.includes("rule_code = 'PAYMENT_OVERDUE'")) return { id: 3, rule_type: "OVERDUE", threshold_value: 0, enabled: 1 };
      if (sql.includes("rule_code = 'STOCK_OVERSTOCK'")) return { id: 4, rule_type: "STOCK_OVERSTOCK", threshold_value: 30, enabled: 1 };
      return null;
    });
    mocks.queryWithTenant.mockImplementation(async (sql: string) => {
      if (sql.includes("rule_type = 'EXPIRY'") && sql.includes("t_alert_rule")) return [{ id: 5, rule_type: "EXPIRY", threshold_value: 7, enabled: 1 }];
      // safetyStock=0 -> max(safetyStock*0.3, 1) = 1 -> availableQty<=1 -> CRITICAL
      if (sql.includes("t_inventory_balance ib")) return [{ storeId: 1, skuId: 101, skuName: "A", availableQty: 1, safetyStock: 0 }];
      // remainingDays=10 >= 7 -> CRITICAL
      if (sql.includes("remainingDays")) return [{ skuId: 102, skuName: "B", batchNo: "BN", expiryDate: "2026-09-01", qty: 5, remainingDays: 10 }];
      if (sql.includes("ageDays")) return [{ skuId: 103, skuName: "C", batchNo: "BN", qty: 8, inStockDate: "2026-01-01", ageDays: 60 }];
      // first record totalDebt=0 -> creditLimit<=0 -> 跳过；second 触发 CRITICAL
      if (sql.includes("totalDebt")) return [
        { customerId: 201, customerName: "X", totalDebt: 0 },
        { customerId: 202, customerName: "Y", totalDebt: 2000 },
      ];
      // overdueDays=30 >= 30 -> CRITICAL
      if (sql.includes("overdueDays")) return [{ billNo: "B1", customerId: 301, customerName: "Z", receivableAmount: 500, receivedAmount: 0, unreceivedAmount: 500, dueDate: "2026-01-01", overdueDays: 30 }];
      return [];
    });

    const res = await runAllAlertChecks("t1");
    expect(res.total).toBeGreaterThan(0);
    expect(res.credit).toBe(1); // 仅第二条 credit 记录生成预警
    expect(res.overdue).toBe(1);
  });

  it("无租户参数时遍历所有活跃租户（覆盖 getAllActiveTenants）", async () => {
    mocks.query.mockResolvedValue([{ tenant_id: "t1" }, { tenant_id: "t2" }]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await runAllAlertChecks();
    expect(res.total).toBe(0);
    expect(mocks.query).toHaveBeenCalledWith("SELECT DISTINCT tenant_id FROM t_sys_user WHERE status = 1");
  });

  it("各规则未启用时提前返回 0", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await runAllAlertChecks("t1");
    expect(res.total).toBe(0);
  });
});

describe("alert.service - listAlerts", () => {
  it("无筛选返回记录 + total", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, alertNo: "YJ1", ruleType: "STOCK_LOW", status: "PENDING" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listAlerts({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(1);
    expect(res.records.length).toBe(1);
  });

  it("带 ruleType / alertLevel / status 筛选拼接条件", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await listAlerts({ page: 1, pageSize: 10, tenantId: "t1", ruleType: "EXPIRY", alertLevel: "WARNING", status: "PENDING" });
    const sql = (mocks.queryWithTenant.mock.calls[0] as unknown as [string])[0];
    expect(sql).toContain("ar.rule_type = ?");
    expect(sql).toContain("ar.alert_level = ?");
    expect(sql).toContain("ar.status = ?");
  });

  it("totalRow 为空兜底 0", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue(null);
    const res = await listAlerts({ page: 1, pageSize: 10, tenantId: "t1" });
    expect(res.total).toBe(0);
  });
});

describe("alert.service - getAlertCounts", () => {
  it("聚合各维度计数（pending/handled/ignored + byType/byLevel）", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ ruleType: "STOCK_LOW", count: 2 }])
      .mockResolvedValueOnce([{ alertLevel: "WARNING", count: 4 }]);
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ count: 5 })
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 1 });

    const res = await getAlertCounts("t1");
    expect(res.totalPending).toBe(5);
    expect(res.totalHandled).toBe(3);
    expect(res.totalIgnored).toBe(1);
    expect(res.byType).toEqual({ STOCK_LOW: 2 });
    expect(res.byLevel).toEqual({ WARNING: 4 });
  });
});

describe("alert.service - handleAlert", () => {
  it("记录不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(handleAlert(1, "t1", "HANDLE", "备注", 7, "管理员"))
      .rejects.toMatchObject({ statusCode: 404, message: "预警记录不存在" });
  });

  it("已处理抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "HANDLED" });
    await expect(handleAlert(1, "t1", "HANDLE", "备注", 7, "管理员"))
      .rejects.toMatchObject({ statusCode: 400, message: "该预警已处理，无法重复操作" });
  });

  it("HANDLE 动作置为 HANDLED", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING" });
    mocks.queryWithTenant.mockResolvedValue([{}]);
    const res = await handleAlert(1, "t1", "HANDLE", "已处理", 7, "管理员");
    expect(res.status).toBe("HANDLED");
    expect(res.handlerName).toBe("管理员");
  });

  it("非 HANDLE 动作置为 IGNORED", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING" });
    mocks.queryWithTenant.mockResolvedValue([{}]);
    const res = await handleAlert(1, "t1", "IGNORE", "忽略", 7, "管理员");
    expect(res.status).toBe("IGNORED");
  });

  it("username 缺省时 handlerName 为 system", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ id: 1, status: "PENDING" });
    mocks.queryWithTenant.mockResolvedValue([{}]);
    const res = await handleAlert(1, "t1", "HANDLE", undefined, 7, undefined as unknown as string);
    expect(res.handlerName).toBe("system");
  });
});

describe("alert.service - listAlertRules", () => {
  it("返回规则列表", async () => {
    mocks.queryWithTenant.mockResolvedValue([{
      id: 1, ruleCode: "STOCK_LOW", ruleName: "库存不足", ruleType: "STOCK_LOW",
      enabled: 1, thresholdValue: 10, thresholdUnit: null, extraConfig: null,
      description: null, createdAt: "2026-01-01", updatedAt: "2026-01-01",
    }]);
    const res = await listAlertRules("t1");
    expect(res.records.length).toBe(1);
    expect(res.records[0].ruleCode).toBe("STOCK_LOW");
  });
});

describe("alert.service - updateAlertRule", () => {
  it("规则不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    await expect(updateAlertRule(1, "t1", { enabled: true }))
      .rejects.toMatchObject({ statusCode: 404, message: "预警规则不存在" });
  });

  it("全字段更新并返回最新规则", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({
        id: 1, ruleCode: "STOCK_LOW", ruleName: "库存不足", ruleType: "STOCK_LOW",
        enabled: 0, thresholdValue: 20, thresholdUnit: null, extraConfig: null,
        description: "新描述", createdAt: "2026-01-01", updatedAt: "2026-02-01",
      });
    mocks.queryWithTenant.mockResolvedValue([{}]);
    const res = await updateAlertRule(1, "t1", { enabled: false, thresholdValue: 20, description: "新描述" });
    expect(res?.enabled).toBe(0);
    expect(res?.thresholdValue).toBe(20);
    const updateSql = (mocks.queryWithTenant.mock.calls[0] as unknown as [string])[0];
    expect(updateSql).toContain("enabled = ?");
    expect(updateSql).toContain("threshold_value = ?");
    expect(updateSql).toContain("description = ?");
  });

  it("无更新字段时不执行 UPDATE，仅返回规则", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 1, ruleCode: "STOCK_LOW" });
    const res = await updateAlertRule(1, "t1", {});
    expect(mocks.queryWithTenant).not.toHaveBeenCalled();
    expect(res?.id).toBe(1);
  });
});

describe("alert.service - runCheck", () => {
  it("返回完成消息并携带统计", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(null);
    mocks.queryWithTenant.mockResolvedValue([]);
    const res = await runCheck("t1");
    expect(res.message).toContain("预警检查完成");
    expect(res.total).toBe(0);
  });
});

describe("alert.service - startAlertScheduler", () => {
  it("定时回调执行检查并覆盖回调内分支", () => {
    vi.useFakeTimers();
    mocks.query.mockResolvedValue([{ tenant_id: "t1" }]);
    mocks.queryOneWithTenant.mockImplementation(async (sql: string) => {
      if (sql.includes("rule_code = 'STOCK_LOW'")) return { id: 1, rule_type: "STOCK_LOW", threshold_value: 10, enabled: 1 };
      return null;
    });
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));

    expect(() => startAlertScheduler()).not.toThrow();
    // 触发首轮 setTimeout(30s) 与 setInterval(1h) 回调
    vi.advanceTimersByTime(31 * 1000);
    vi.advanceTimersByTime(61 * 60 * 1000);
    vi.useRealTimers();
    expect(mocks.query).toHaveBeenCalled();
  });
});
