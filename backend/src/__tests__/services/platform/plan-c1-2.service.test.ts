/**
 * C1-2 批次 B（套餐域）service 级测试：
 * - plan-upgrade-flow.service：range 校验 + 真实数据源聚合 + 空态
 * - plan-copy.service：编码冲突 409 / 状态校验 400 / features+policy 复制 / 读回自证
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  getPlan: vi.fn(),
  createPlan: vi.fn(),
  getPlanPolicy: vi.fn(),
  updatePlanPolicy: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

vi.mock("../../../services/admin/subscription-plan.service", () => ({
  getPlan: mocks.getPlan,
  createPlan: mocks.createPlan,
}));

vi.mock("../../../services/platform/plan-policy.service", () => ({
  getPlanPolicy: mocks.getPlanPolicy,
  updatePlanPolicy: mocks.updatePlanPolicy,
}));

import {
  getUpgradeFlowReport,
  normalizeRange,
} from "../../../services/platform/plan-upgrade-flow.service";
import { copyPlan } from "../../../services/platform/plan-copy.service";

const SOURCE_PLAN = {
  id: 2,
  planCode: "STANDARD",
  planName: "标准版",
  planType: "YEARLY",
  price: 1999,
  originalPrice: 2999,
  durationDays: 365,
  maxUsers: 30,
  maxStores: 5,
  maxCustomers: 5000,
  maxProducts: 100000,
  maxStorageMb: 102400,
  features: ["basic_sales", "basic_inventory"],
  moduleAccess: ["sales", "inventory"],
  description: "标准版套餐",
  sortOrder: 2,
  status: "ACTIVE",
  createdAt: "2026-01-01 00:00:00",
  updatedAt: "2026-01-01 00:00:00",
};

describe("plan-upgrade-flow.service（C1-2 B1）", () => {
  beforeEach(() => vi.resetAllMocks());

  it("normalizeRange：默认 month，三个合法值放行，非法值 400（不静默回落）", () => {
    expect(normalizeRange(undefined)).toBe("month");
    expect(normalizeRange("3m")).toBe("3m");
    expect(normalizeRange("12M")).toBe("12m");
    expect(() => normalizeRange("99y")).toThrow();
    try {
      normalizeRange("99y");
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
    }
  });

  it("聚合来自 t_subscription_operation_log，UPGRADE/DOWNGRADE 映射为 UP/DOWN", async () => {
    mocks.query.mockResolvedValueOnce([
      {
        direction: "UPGRADE",
        fromPlanId: 1,
        fromPlanName: "基础版",
        toPlanId: 2,
        toPlanName: "标准版",
        eventCount: "2",
        tenantCount: "2",
        lastAt: "2026-09-10 10:00:00",
      },
      {
        direction: "DOWNGRADE",
        fromPlanId: 2,
        fromPlanName: "标准版",
        toPlanId: 1,
        toPlanName: "基础版",
        eventCount: 1,
        tenantCount: 1,
        lastAt: null,
      },
    ]);
    mocks.queryOne.mockResolvedValueOnce({ events: 3, tenants: 2 });

    const report = await getUpgradeFlowReport("3m");

    expect(report.range).toBe("3m");
    expect(report.summary).toEqual({ events: 3, tenants: 2 });
    expect(report.records[0].dir).toBe("UP");
    expect(report.records[0].eventCount).toBe(2);
    expect(report.records[1].dir).toBe("DOWN");
    expect(report.records[1].lastAt).toBeNull();
    expect(report.dataSource).toContain("t_subscription_operation_log");

    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("FROM t_subscription_operation_log");
    expect(sql).toContain("COUNT(DISTINCT s.tenant_id)");
    expect(sql).toContain("l.operation_type IN ('UPGRADE','DOWNGRADE')");
    expect(params[0]).toBeInstanceOf(Date);
  });

  it("无记录 → 空数组（前端空态），summary 归零，不造数据", async () => {
    mocks.query.mockResolvedValueOnce([]);
    mocks.queryOne.mockResolvedValueOnce({ events: 0, tenants: 0 });

    const report = await getUpgradeFlowReport("month");
    expect(report.records).toEqual([]);
    expect(report.summary).toEqual({ events: 0, tenants: 0 });
  });
});

describe("plan-copy.service（C1-2 B2）", () => {
  beforeEach(() => vi.resetAllMocks());

  it("planId 非法 → 400", async () => {
    await expect(copyPlan(0, {}, "platform_admin")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("源套餐不存在 → 404", async () => {
    mocks.getPlan.mockResolvedValueOnce(null);
    await expect(copyPlan(999, {}, "platform_admin")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("显式编码冲突 → 409（不创建）", async () => {
    mocks.getPlan.mockResolvedValueOnce(SOURCE_PLAN);
    mocks.queryOne.mockResolvedValueOnce({ id: 5 }); // 编码已存在

    await expect(
      copyPlan(2, { planCode: "BASIC" }, "platform_admin")
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.createPlan).not.toHaveBeenCalled();
  });

  it("状态非法 → 400（不创建）", async () => {
    mocks.getPlan.mockResolvedValueOnce(SOURCE_PLAN);
    await expect(
      copyPlan(2, { status: "PUBLISHED" }, "platform_admin")
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.createPlan).not.toHaveBeenCalled();
  });

  it("成功：复制套餐字段 + features/moduleAccess + 策略包，默认停售，并读回自证", async () => {
    mocks.getPlan
      .mockResolvedValueOnce(SOURCE_PLAN)
      .mockResolvedValueOnce({ ...SOURCE_PLAN, id: 9, planCode: "STANDARD-COPY", planName: "标准版（副本）", status: "INACTIVE" });
    mocks.queryOne.mockResolvedValueOnce(null); // 自动编码未被占用
    mocks.createPlan.mockResolvedValueOnce({ plan_code: "STANDARD-COPY", id: 9 });
    mocks.getPlanPolicy.mockResolvedValueOnce({
      version: 1,
      upgrade: { mode: "IMMEDIATE" },
      _unconfigured: ["downgrade", "renew", "promo", "quota"],
      _configured: true,
    });
    mocks.updatePlanPolicy.mockResolvedValueOnce({ updated: true });

    const result = await copyPlan(2, {}, "platform_admin");

    expect(mocks.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        planCode: "STANDARD-COPY",
        planName: "标准版（副本）",
        planType: "YEARLY",
        price: 1999,
        durationDays: 365,
        maxProducts: 100000,
        features: ["basic_sales", "basic_inventory"],
        moduleAccess: ["sales", "inventory"],
        status: "INACTIVE",
      })
    );
    // 策略包复制：_ 前缀元字段不落库
    expect(mocks.updatePlanPolicy).toHaveBeenCalledWith(
      9,
      { version: 1, upgrade: { mode: "IMMEDIATE" } },
      "platform_admin"
    );
    expect(result.copied).toEqual({ features: true, moduleAccess: true, policy: true });
    expect(result.readBack.id).toBe(9);
    expect(result.readBack.status).toBe("INACTIVE");
  });

  it("源套餐无策略配置 → 不写策略包（不造默认值），且如实标记 policy=false", async () => {
    mocks.getPlan
      .mockResolvedValueOnce({ ...SOURCE_PLAN, features: "[\"a\"]" }) // features 为字符串形态（mysql2 可能返回字符串）
      .mockResolvedValueOnce({ ...SOURCE_PLAN, id: 10, planCode: "STANDARD-COPY", status: "INACTIVE" });
    mocks.queryOne.mockResolvedValueOnce(null);
    mocks.createPlan.mockResolvedValueOnce({ plan_code: "STANDARD-COPY", id: 10 });
    mocks.getPlanPolicy.mockResolvedValueOnce({
      version: 1,
      _unconfigured: ["quota", "upgrade", "downgrade", "renew", "promo"],
      _configured: false,
    });

    const result = await copyPlan(2, { planName: "副本A" }, "platform_admin");

    expect(mocks.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({ features: ["a"], planName: "副本A" })
    );
    expect(mocks.updatePlanPolicy).not.toHaveBeenCalled();
    expect(result.copied.policy).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it("新套餐读回为空 → 500（自证闭环失败即判失败）", async () => {
    mocks.getPlan.mockResolvedValueOnce(SOURCE_PLAN).mockResolvedValueOnce(null);
    mocks.queryOne.mockResolvedValueOnce(null);
    mocks.createPlan.mockResolvedValueOnce({ plan_code: "STANDARD-COPY", id: 11 });
    mocks.getPlanPolicy.mockResolvedValueOnce({ version: 1, _unconfigured: [], _configured: false });

    await expect(copyPlan(2, {}, "platform_admin")).rejects.toMatchObject({ statusCode: 500 });
  });
});
