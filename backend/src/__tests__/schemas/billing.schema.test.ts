import { describe, it, expect } from "vitest";
import {
  arrearsPolicySchema,
  addonPriceSchema,
  ARREARS_POLICY_KEYS,
} from "../../schemas/billing.schema";

/**
 * R101-S2-02 组2 契约护栏：
 * 1) 欠费策略 / 增值单价 均须带 version（护栏③）
 * 2) 未配置子项不得被补默认值（护栏④）——此前前端是硬编码 15/90 天与 ¥10/¥50/¥0.1
 * 3) 通道限定白名单，防脏值
 */
describe("schemas/billing.schema（R101-S2-02 组2 账单类契约）", () => {
  it("欠费策略包：空对象补 version=1，其余子项保持 undefined（不内置预设值）", () => {
    const parsed = arrearsPolicySchema.parse({});
    expect(parsed).toEqual({ version: 1 });
    expect(parsed.graceDays).toBeUndefined();
    expect(parsed.retainDays).toBeUndefined();
    expect(parsed.autoDowngrade).toBeUndefined();
  });

  it("欠费策略包：接受完整配置", () => {
    const parsed = arrearsPolicySchema.parse({
      version: 1,
      graceDays: 15,
      freezeAfterDays: 30,
      retainDays: 90,
      remindNodes: [7, 3, 1],
      channels: ["IN_APP", "SMS"],
      autoDowngrade: true,
      autoFreeze: true,
      autoRemind: true,
      autoCancel: false,
    });
    expect(parsed.graceDays).toBe(15);
    expect(parsed.remindNodes).toEqual([7, 3, 1]);
    expect(parsed.channels).toEqual(["IN_APP", "SMS"]);
    // false = 已配置为关闭，与 undefined（未配置）语义不同
    expect(parsed.autoCancel).toBe(false);
  });

  it("欠费策略包：非法通道与负天数必须报错（不静默通过）", () => {
    expect(() => arrearsPolicySchema.parse({ channels: ["站内"] })).toThrow();
    expect(() => arrearsPolicySchema.parse({ graceDays: -1 })).toThrow();
    expect(() => arrearsPolicySchema.parse({ remindNodes: [-3] })).toThrow();
  });

  it("增值单价包：空对象补 version=1，单价保持 undefined（不内置 ¥10/¥50/¥0.1）", () => {
    const parsed = addonPriceSchema.parse({});
    expect(parsed).toEqual({ version: 1 });
    expect(parsed.storagePerGbMonth).toBeUndefined();
    expect(parsed.apiPer10k).toBeUndefined();
    expect(parsed.smsPerItem).toBeUndefined();
  });

  it("增值单价包：接受配置并拒绝负数", () => {
    const parsed = addonPriceSchema.parse({
      version: 1,
      storagePerGbMonth: 10,
      apiPer10k: 50,
      smsPerItem: 0.1,
    });
    expect(parsed.storagePerGbMonth).toBe(10);
    expect(() => addonPriceSchema.parse({ smsPerItem: -0.1 })).toThrow();
  });

  it("顶层键清单含新增的 freezeAfterDays（_unconfigured 依赖它）", () => {
    expect([...ARREARS_POLICY_KEYS]).toContain("freezeAfterDays");
    expect([...ARREARS_POLICY_KEYS]).toContain("graceDays");
  });
});
