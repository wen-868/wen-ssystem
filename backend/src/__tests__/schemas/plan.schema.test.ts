import { describe, it, expect } from "vitest";
import {
  PLAN_STATUSES,
  PLAN_TYPES,
  planFeaturesSchema,
  planPolicySchema,
} from "../../schemas/plan.schema";

/**
 * R101-S2-02 组1 契约护栏：
 * 1) plan_type 必须覆盖前端 chips 的五种计费周期（否则季付/自定义天数 400）
 * 2) status 必须含 DRAFT（否则「存为草稿」400）
 * 3) features 必须是「功能特性码数组」（生产既有语义；公开端点透出，禁止塞配置）
 * 4) 策略包 planPolicySchema 必须带 version（护栏③），未配置子项不得补默认值（护栏④）
 */
describe("schemas/plan.schema（R101-S2-02 组1 套餐契约）", () => {
  it("PLAN_TYPES 覆盖 MONTHLY/QUARTERLY/YEARLY/PERMANENT/CUSTOM", () => {
    expect([...PLAN_TYPES]).toEqual([
      "MONTHLY",
      "QUARTERLY",
      "YEARLY",
      "PERMANENT",
      "CUSTOM",
    ]);
  });

  it("PLAN_STATUSES 含 DRAFT/ACTIVE/INACTIVE", () => {
    expect([...PLAN_STATUSES]).toEqual(["DRAFT", "ACTIVE", "INACTIVE"]);
  });

  it("features 为功能特性码数组（生产种子数据形态）", () => {
    const parsed = planFeaturesSchema.parse([
      "basic_sales",
      "basic_inventory",
      "basic_report",
    ]);
    expect(parsed).toEqual(["basic_sales", "basic_inventory", "basic_report"]);
    expect(planFeaturesSchema.parse([])).toEqual([]);
  });

  it("features 拒绝非数组形态（配置对象不得混入该列）", () => {
    expect(() => planFeaturesSchema.parse({ version: 1, quota: {} })).toThrow();
    expect(() => planFeaturesSchema.parse("basic_sales")).toThrow();
  });

  it("策略包：空对象补 version=1（护栏③ 强制版本号）", () => {
    expect(planPolicySchema.parse({})).toEqual({ version: 1 });
  });

  it("策略包：接受 配额/升降级/续费/限时活动 结构化配置", () => {
    const parsed = planPolicySchema.parse({
      version: 1,
      quota: { apiDaily: 100000, aiMonthly: 5000 },
      upgrade: { mode: "IMMEDIATE" },
      downgrade: { mode: "NEXT_CYCLE" },
      renew: { policy: "ALLOW_LAST_YEAR" },
      promo: { price: 199, start: "2026-10-01", end: "2026-10-07" },
    });
    expect(parsed.quota?.apiDaily).toBe(100000);
    expect(parsed.quota?.aiMonthly).toBe(5000);
    expect(parsed.upgrade?.mode).toBe("IMMEDIATE");
    expect(parsed.renew?.policy).toBe("ALLOW_LAST_YEAR");
    expect(parsed.promo?.price).toBe(199);
  });

  it("策略包：越界枚举值必须报错（不静默通过）", () => {
    expect(() => planPolicySchema.parse({ upgrade: { mode: "INSTANT" } })).toThrow();
    expect(() => planPolicySchema.parse({ renew: { policy: "WHATEVER" } })).toThrow();
    expect(() => planPolicySchema.parse({ quota: { apiDaily: -1 } })).toThrow();
  });

  it("策略包：未配置的子项保持 undefined（不得补默认值冒充已配置）", () => {
    const parsed = planPolicySchema.parse({ version: 2 });
    expect(parsed.quota).toBeUndefined();
    expect(parsed.upgrade).toBeUndefined();
    expect(parsed.downgrade).toBeUndefined();
    expect(parsed.renew).toBeUndefined();
    expect(parsed.promo).toBeUndefined();
  });
});
