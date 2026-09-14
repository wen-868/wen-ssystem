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
 * 4) 4 段边界严格递增：宽限截止 < 降级截止 < 冻结截止 < 保留截止
 *    （仅相邻两段都配置时才校验，未配置的相邻对不参与校验）
 */
describe("schemas/billing.schema（R101-S2-02 组2 账单类契约）", () => {
  it("欠费策略包：空对象补 version=1，其余子项保持 undefined（不内置预设值）", () => {
    const parsed = arrearsPolicySchema.parse({});
    expect(parsed).toEqual({ version: 1 });
    expect(parsed.graceEndDays).toBeUndefined();
    expect(parsed.retainEndDays).toBeUndefined();
    expect(parsed.autoDowngrade).toBeUndefined();
  });

  it("欠费策略包：接受完整 4 段边界配置", () => {
    const parsed = arrearsPolicySchema.parse({
      version: 1,
      graceEndDays: 15,
      degradeEndDays: 30,
      freezeEndDays: 60,
      retainEndDays: 90,
      remindNodes: [7, 3, 1],
      channels: ["IN_APP", "SMS"],
      autoDowngrade: true,
      autoFreeze: true,
      autoRemind: true,
      autoCancel: false,
    });
    expect(parsed.graceEndDays).toBe(15);
    expect(parsed.degradeEndDays).toBe(30);
    expect(parsed.freezeEndDays).toBe(60);
    expect(parsed.retainEndDays).toBe(90);
    expect(parsed.remindNodes).toEqual([7, 3, 1]);
    expect(parsed.channels).toEqual(["IN_APP", "SMS"]);
    // false = 已配置为关闭，与 undefined（未配置）语义不同
    expect(parsed.autoCancel).toBe(false);
  });

  it("欠费策略包：非法通道与负天数必须报错（不静默通过）", () => {
    expect(() => arrearsPolicySchema.parse({ channels: ["站内"] })).toThrow();
    expect(() => arrearsPolicySchema.parse({ graceEndDays: -1 })).toThrow();
    expect(() => arrearsPolicySchema.parse({ remindNodes: [-3] })).toThrow();
  });

  it("4 段边界严格递增：15/30/60/90 通过", () => {
    const parsed = arrearsPolicySchema.parse({
      version: 1,
      graceEndDays: 15,
      degradeEndDays: 30,
      freezeEndDays: 60,
      retainEndDays: 90,
    });
    expect(parsed).toMatchObject({
      graceEndDays: 15,
      degradeEndDays: 30,
      freezeEndDays: 60,
      retainEndDays: 90,
    });
  });

  it("4 段边界：graceEndDays >= degradeEndDays 被拒绝，中文报错含「宽限截止」「降级截止」", () => {
    let err: unknown;
    try {
      arrearsPolicySchema.parse({ version: 1, graceEndDays: 30, degradeEndDays: 20 });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
    const msg = (err as Error).message;
    expect(msg).toContain("宽限截止");
    expect(msg).toContain("降级截止");
  });

  it("4 段边界：freezeEndDays >= retainEndDays 被拒绝，中文报错含「冻结截止」「保留截止」", () => {
    let err: unknown;
    try {
      arrearsPolicySchema.parse({
        version: 1,
        graceEndDays: 15,
        degradeEndDays: 30,
        freezeEndDays: 60,
        retainEndDays: 40,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
    const msg = (err as Error).message;
    expect(msg).toContain("冻结截止");
    expect(msg).toContain("保留截止");
  });

  it("4 段边界：只配置部分字段（graceEndDays=15、degradeEndDays=30）通过，不配的相邻对不校验", () => {
    const parsed = arrearsPolicySchema.parse({
      version: 1,
      graceEndDays: 15,
      degradeEndDays: 30,
    });
    expect(parsed.graceEndDays).toBe(15);
    expect(parsed.degradeEndDays).toBe(30);
  });

  it("4 段边界：只配 graceEndDays=30、degradeEndDays=20 仍被拒绝", () => {
    expect(() =>
      arrearsPolicySchema.parse({ version: 1, graceEndDays: 30, degradeEndDays: 20 })
    ).toThrow();
  });

  it("4 段边界：全不配（只有 version）通过", () => {
    const parsed = arrearsPolicySchema.parse({ version: 1 });
    expect(parsed).toEqual({ version: 1 });
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

  it("顶层键清单含 4 段边界键（_unconfigured 依赖它们）", () => {
    expect([...ARREARS_POLICY_KEYS]).toContain("graceEndDays");
    expect([...ARREARS_POLICY_KEYS]).toContain("degradeEndDays");
    expect([...ARREARS_POLICY_KEYS]).toContain("freezeEndDays");
    expect([...ARREARS_POLICY_KEYS]).toContain("retainEndDays");
    expect([...ARREARS_POLICY_KEYS]).toHaveLength(10);
  });
});
