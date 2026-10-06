/**
 * 批A（Issue #261）后端 3 项的服务层单测：
 *   S3-29④：订阅写体 amount / endDate 不再被 zod 静默丢弃（生效 / 非法值 400）
 *   S3-34 ：module_access 写入 t_tenant_module_access 时 code 只能取码表英文码（写中文不得进 code）
 *   S3-26 ：订阅详情补 originalAmount、操作日志补 detail（只读聚合，不改表）
 *
 * 范式：mock `shared/db` 与 `shared/id`，捕获真实下发的 SQL 与绑定参数。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const hoisted = vi.hoisted(() => ({
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(() => "SUB20261006001"),
  statements: [] as Array<{ sql: string; params: unknown[] }>,
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: hoisted.queryOne,
  queryWithTenant: hoisted.queryWithTenant,
  queryOneWithTenant: hoisted.queryOneWithTenant,
  transaction: hoisted.transaction,
}));

vi.mock("../../../shared/id", () => ({ makeBizNo: hoisted.makeBizNo }));

import {
  createSubscription,
  changePlan,
  listSubscriptions,
  getSubscription,
} from "../../../services/admin/subscription.service";
import { renewSubscription } from "../../../services/admin/subscription-renewal.service";

/** 捕获事务内真实下发的 (sql, params) */
function setupTransactionCapture() {
  hoisted.statements = [];
  hoisted.transaction.mockImplementation(
    async (runner: (conn: unknown) => Promise<unknown>) =>
      runner({
        execute: async (sql: string, params: unknown[] = []) => {
          hoisted.statements.push({ sql, params });
          return [{}, {}];
        },
      })
  );
}

const INSERT_SUBSCRIPTION = "INSERT INTO t_subscription (";
const INSERT_MODULE = "INSERT INTO t_tenant_module_access";

function findStatement(fragment: string) {
  return hoisted.statements.find((s) => s.sql.includes(fragment));
}

beforeEach(() => {
  vi.clearAllMocks();
  setupTransactionCapture();
});

describe("S3-26：订阅详情 originalAmount / 操作日志 detail（只读聚合，不改表）", () => {
  it("列表与详情 SQL 均 LEFT JOIN 套餐取 p.original_price AS originalAmount", async () => {
    hoisted.queryWithTenant.mockResolvedValue([]);
    hoisted.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await listSubscriptions("t1", { page: 1, pageSize: 10 });
    const listSql = String(hoisted.queryWithTenant.mock.calls[0][0]);
    expect(listSql).toContain("p.original_price AS originalAmount");
    expect(listSql).toContain("LEFT JOIN t_subscription_plan p ON p.id = s.plan_id");

    hoisted.queryOneWithTenant.mockResolvedValue({ id: 1 });
    hoisted.queryWithTenant.mockResolvedValue([]);
    await getSubscription(1, "t1");
    const detailCalls = hoisted.queryOneWithTenant.mock.calls;
    const detailSql = String(detailCalls[detailCalls.length - 1]?.[0]);
    expect(detailSql).toContain("p.original_price AS originalAmount");
  });

  it("操作日志 SQL 取 remark AS detail（不改表，新增返回字段）", async () => {
    hoisted.queryOneWithTenant.mockResolvedValue({ id: 1 });
    hoisted.queryWithTenant.mockResolvedValue([]);
    await getSubscription(1, "t1");
    const logCalls = hoisted.queryWithTenant.mock.calls;
    const logSql = String(logCalls[logCalls.length - 1]?.[0]);
    expect(logSql).toContain("remark AS detail");
  });
});

describe("S3-29④：订阅写体 amount / endDate 生效（不再静默丢弃）", () => {
  it("createSubscription：传 amount/endDate ⇒ 落库价与结束日期即为所传值", async () => {
    hoisted.queryOne
      .mockResolvedValueOnce({ id: 2, company_name: "测试公司", expire_at: "2026-01-01" })
      .mockResolvedValueOnce({
        id: 1, plan_name: "基础版", plan_type: "MONTHLY", price: 299, duration_days: 30, module_access: null,
      });

    const res = await createSubscription(
      { tenantId: 2, planId: 1, startDate: "2026-10-06", amount: 1500, endDate: "2027-03-01", autoRenew: 0 },
      1, "admin", "t1"
    );
    expect(res).toEqual({ subscription_no: "SUB20261006001" });

    const insert = findStatement(INSERT_SUBSCRIPTION);
    expect(insert).toBeTruthy();
    // start_date=索引5，end_date=索引6，price=索引8
    expect(insert!.params[6]).toBe("2027-03-01");
    expect(insert!.params[8]).toBe(1500);
  });

  it("createSubscription：endDate 早于/等于 startDate ⇒ 400 明确文案，且不落库", async () => {
    hoisted.queryOne
      .mockResolvedValueOnce({ id: 2, company_name: "测试公司", expire_at: "2026-01-01" })
      .mockResolvedValueOnce({
        id: 1, plan_name: "基础版", plan_type: "MONTHLY", price: 299, duration_days: 30, module_access: null,
      });

    const res = await createSubscription(
      { tenantId: 2, planId: 1, startDate: "2026-10-06", endDate: "2026-10-01", autoRenew: 0 },
      1, "admin", "t1"
    );
    expect(res).toMatchObject({ code: "400" });
    expect((res as unknown as { message: string }).message).toContain("结束日期");
    expect(hoisted.statements).toHaveLength(0);
  });

  it("createSubscription：amount 为负数 ⇒ 400 明确文案，且不落库", async () => {
    hoisted.queryOne
      .mockResolvedValueOnce({ id: 2, company_name: "测试公司", expire_at: "2026-01-01" })
      .mockResolvedValueOnce({
        id: 1, plan_name: "基础版", plan_type: "MONTHLY", price: 299, duration_days: 30, module_access: null,
      });

    const res = await createSubscription(
      { tenantId: 2, planId: 1, startDate: "2026-10-06", amount: -5, autoRenew: 0 },
      1, "admin", "t1"
    );
    expect(res).toMatchObject({ code: "400" });
    expect((res as unknown as { message: string }).message).toContain("金额");
    expect(hoisted.statements).toHaveLength(0);
  });

  it("renewSubscription：传 amount/endDate ⇒ 新订阅价与续至日期即为所传值", async () => {
    hoisted.queryOneWithTenant.mockResolvedValueOnce({
      id: 1, subscription_no: "SUB001", tenant_id: "2", plan_id: 1,
      plan_name: "基础版", end_date: "2026-10-31", price: 299, duration_days: 30, plan_price: 299,
    });
    hoisted.queryOne.mockResolvedValueOnce({
      id: 1, plan_name: "基础版", plan_type: "MONTHLY", price: 299, duration_days: 30, module_access: null,
    });

    const res = await renewSubscription(
      1, { amount: 888, endDate: "2027-06-30" }, 1, "admin", "t1"
    );
    expect(res).toEqual({ subscription_no: "SUB20261006001" });

    const insert = findStatement(INSERT_SUBSCRIPTION);
    expect(insert!.params[6]).toBe("2027-06-30");
    expect(insert!.params[8]).toBe(888);
  });

  it("changePlan：amount 生效为日志补差金额，但 UPGRADE/DOWNGRADE 仍按套餐价差判定（不改判定口径）", async () => {
    hoisted.queryOneWithTenant.mockResolvedValueOnce({
      id: 1, subscription_no: "SUB001", tenant_id: "2", plan_id: 1, plan_name: "基础版",
      end_date: "2026-12-31", status: "ACTIVE",
    });
    hoisted.queryOne
      .mockResolvedValueOnce({ id: 9, plan_name: "专业版", plan_type: "YEARLY", price: 999, duration_days: 365, module_access: null })
      .mockResolvedValueOnce({ id: 1, plan_name: "基础版", price: 299 });

    const res = await changePlan(1, { newPlanId: 9, amount: 100 }, 1, "admin", "t1");
    expect(res).toEqual({ price_diff: 100 });

    const log = findStatement("INSERT INTO t_subscription_operation_log");
    // 操作类型仍由套餐价差 999-299>0 决定（UPGRADE），与用户填的补差金额无关
    expect(log!.params[1]).toBe("UPGRADE");
    // 金额列（索引 4）为前端所传补差金额
    expect(log!.params[4]).toBe(100);
  });
});

describe("S3-34：module_access 写入收口（code 只能是码表值）", () => {
  it("中文条目文案 ⇒ module_code 落英文码、module_name 落文案", async () => {
    hoisted.queryOne
      .mockResolvedValueOnce({ id: 2, company_name: "测试公司", expire_at: "2026-01-01" })
      .mockResolvedValueOnce({
        id: 1, plan_name: "基础版", plan_type: "MONTHLY", price: 299, duration_days: 30,
        module_access: JSON.stringify(["采购管理", "sales"]),
      });

    await createSubscription({ tenantId: 2, planId: 1, startDate: "2026-10-06", autoRenew: 0 }, 1, "admin", "t1");

    const moduleInserts = hoisted.statements.filter((s) => s.sql.includes(INSERT_MODULE));
    const pairs = moduleInserts.map((s) => [s.params[1], s.params[2]]);
    expect(pairs).toEqual([
      ["purchase", "采购管理"],
      ["sales", "销售管理"],
    ]);
    // 硬断言：module_code 位置不得出现任何非 ASCII（中文）字符
    for (const s of moduleInserts) {
      expect(/^[\x20-\x7E]+$/.test(String(s.params[1]))).toBe(true);
    }
  });

  it("非码表值（中文） ⇒ 400 并列出非法值，且不写 module 行（禁止污染 module_code）", async () => {
    hoisted.queryOne
      .mockResolvedValueOnce({ id: 2, company_name: "测试公司", expire_at: "2026-01-01" })
      .mockResolvedValueOnce({
        id: 1, plan_name: "基础版", plan_type: "MONTHLY", price: 299, duration_days: 30,
        module_access: JSON.stringify(["成本核算"]),
      });

    const res = await createSubscription({ tenantId: 2, planId: 1, startDate: "2026-10-06", autoRenew: 0 }, 1, "admin", "t1");
    expect(res).toMatchObject({ code: "400" });
    expect((res as unknown as { message: string }).message).toContain("成本核算");
    expect(hoisted.statements).toHaveLength(0);
  });
});
