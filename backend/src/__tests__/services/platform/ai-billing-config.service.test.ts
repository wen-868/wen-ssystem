import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

import {
  getBillingStrategy,
  updateBillingStrategy,
  getFreeGrant,
  updateFreeGrant,
  getQuotaPacks,
  updateQuotaPacks,
  getPointsRate,
  updatePointsRate,
} from "../../../services/platform/ai-billing-config.service";

/**
 * R101-S2-02 组3：AI 类配置包（t_platform_config，category='ai'）
 * 护栏③：zod + version；护栏④：未配置≠已配置，元字段与 null 不回写。
 */
describe("platform/ai-billing-config.service（R101-S2-02 组3）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("套餐加成倍率未配置：_configured=false 且 _unconfigured 含 plans", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    const p = await getBillingStrategy();
    expect(p._configured).toBe(false);
    expect((p._unconfigured as string[])).toContain("plans");
    expect(p.plans).toBeUndefined();
    const [, params] = mocks.queryOne.mock.calls[0] as [string, unknown[]];
    expect(params[0]).toBe("ai:billing_strategy");
    expect(params[1]).toBe("SAAS");
  });

  it("免费版赠送额度未配置：_unconfigured 含 monthlyCalls / grantModel", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    const a = await getFreeGrant();
    expect(a._configured).toBe(false);
    expect((a._unconfigured as string[])).toContain("monthlyCalls");
    expect((a._unconfigured as string[])).toContain("grantModel");
    expect(a.monthlyCalls).toBeUndefined();
    expect(a.grantModel).toBeUndefined();
  });

  it("额度包未配置：_unconfigured 含 packs", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    const q = await getQuotaPacks();
    expect(q._configured).toBe(false);
    expect((q._unconfigured as string[])).toContain("packs");
    expect(q.packs).toBeUndefined();
  });

  it("积分汇率未配置：_unconfigured 含 points / tokens / enabled", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    const r = await getPointsRate();
    expect(r._configured).toBe(false);
    expect((r._unconfigured as string[])).toContain("points");
    expect((r._unconfigured as string[])).toContain("tokens");
    expect((r._unconfigured as string[])).toContain("enabled");
    expect(r.points).toBeUndefined();
  });

  it("保存套餐加成倍率：落 ai:billing_strategy，写 updated_by 与 category=ai", async () => {
    mocks.queryOne.mockResolvedValueOnce(null); // 不存在 → INSERT
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    await updateBillingStrategy(
      { plans: { basic: { multiplier: 1.2, exhaustion: "overage" } } },
      "platform_admin"
    );

    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO t_platform_config");
    // 参数序：platform, tenant_id, config_key, config_value, category, description, updated_by
    expect(params[0]).toBe("SAAS");
    expect(params[2]).toBe("ai:billing_strategy");
    expect(params[4]).toBe("ai");
    expect(params[6]).toBe("platform_admin");
    const json = JSON.parse(String(params[3]));
    expect(json.version).toBe(1);
    expect(json.plans.basic.multiplier).toBe(1.2);
    expect(json.plans.basic.exhaustion).toBe("overage");
  });

  it("保存免费版赠送额度：落 ai:free_grant，category=ai", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    await updateFreeGrant({ monthlyCalls: 50, grantModel: "deepseek-v3" }, "platform_admin");

    const [, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(params[2]).toBe("ai:free_grant");
    expect(params[4]).toBe("ai");
    const json = JSON.parse(String(params[3]));
    expect(json.monthlyCalls).toBe(50);
    expect(json.grantModel).toBe("deepseek-v3");
  });

  it("保存额度包：落 ai:quota_pack，category=ai", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    await updateQuotaPacks(
      {
        packs: [
          {
            id: "pack-light",
            name: "AI 加量包 · 轻量",
            tokens: 500000,
            price: 99,
            validMonths: 12,
            applicablePlans: [],
            purchaseLimit: null,
            status: "on_sale",
          },
        ],
      },
      "platform_admin"
    );

    const [, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(params[2]).toBe("ai:quota_pack");
    expect(params[4]).toBe("ai");
    const json = JSON.parse(String(params[3]));
    expect(json.packs[0].tokens).toBe(500000);
    expect(json.packs[0].purchaseLimit).toBeNull();
  });

  it("保存积分汇率：落 ai:points_rate，category=ai", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    await updatePointsRate({ points: 1, tokens: 50, enabled: false }, "platform_admin");

    const [, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(params[2]).toBe("ai:points_rate");
    expect(params[4]).toBe("ai");
    const json = JSON.parse(String(params[3]));
    expect(json.points).toBe(1);
    expect(json.tokens).toBe(50);
    expect(json.enabled).toBe(false);
  });

  it("护栏④：_ 前缀元字段不落库（清空即回到未配置语义）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 4 });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    await updateBillingStrategy(
      { plans: {}, _unconfigured: ["plans"], _configured: false } as Record<string, unknown>,
      "platform_admin"
    );

    const params = mocks.query.mock.calls[0][1] as unknown[];
    const json = JSON.parse(String(params[0]));
    expect("_unconfigured" in json).toBe(false);
    expect("_configured" in json).toBe(false);
    expect(json.version).toBe(1);
    expect(json.plans).toEqual({});
  });

  it("护栏③：非法结构直接拒绝，不落脏配置", async () => {
    await expect(
      updateBillingStrategy(
        { plans: { basic: { multiplier: -1, exhaustion: "disable" } } },
        "platform_admin"
      )
    ).rejects.toThrow();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("护栏③：枚举非法（exhaustion 越界）被 zod 校验拒绝，不落库", async () => {
    await expect(
      updateBillingStrategy(
        { plans: { basic: { multiplier: 1.2, exhaustion: "unknown_mode" } } } as Record<
          string,
          unknown
        >,
        "admin"
      )
    ).rejects.toThrow();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("护栏③：额度包 status 越界被 zod 校验拒绝，不落库", async () => {
    await expect(
      updateQuotaPacks(
        {
          packs: [
            {
              id: "pack-x",
              name: "X",
              tokens: 100,
              price: 1,
              validMonths: 1,
              applicablePlans: [],
              purchaseLimit: null,
              status: "sold_out",
            },
          ],
        } as Record<string, unknown>,
        "admin"
      )
    ).rejects.toThrow();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("护栏④：清空场景——PUT 仅含 version 的包落库成功(不 400)，且 GET 返回 _configured=false", async () => {
    // 用 freeGrant（顶层键无默认值）验证「清空 = 未配置」语义
    mocks.queryOne.mockResolvedValueOnce(null); // 不存在 → INSERT
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    await updateFreeGrant({ version: 1 }, "platform_admin");

    const [, insertParams] = mocks.query.mock.calls[0] as [string, unknown[]];
    const stored = JSON.parse(String(insertParams[3]));
    expect("_unconfigured" in stored).toBe(false); // 元字段不落库
    expect(stored).toEqual({ version: 1 });

    // 随后 GET 读回刚落库的包
    mocks.queryOne.mockResolvedValueOnce({ id: 9, config_value: String(insertParams[3]) });
    const after = await getFreeGrant();
    expect(after._configured).toBe(false);
    expect((after._unconfigured as string[]).length).toBe(2);
  });

  it("清空语义一致性：容器型包(plans)仅含 version 时同样回到未配置", async () => {
    /* 回归防护：plans/packs 曾带 .default({})/.default([])，落库时会自动补出空容器，
       使 readConfig 判定 hasOwnProperty('plans') 为 true → _configured 恒为 true，
       前端因此不置灰阻断，误导管理员以为已配置。容器型包必须与标量包语义一致。 */
    mocks.queryOne.mockResolvedValueOnce(null);
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    await updateBillingStrategy({ version: 1 }, "platform_admin");

    const [, insertParams] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(JSON.parse(String(insertParams[3]))).toEqual({ version: 1 });

    mocks.queryOne.mockResolvedValueOnce({ id: 11, config_value: String(insertParams[3]) });
    const after = await getBillingStrategy();
    expect(after._configured).toBe(false);
    expect((after._unconfigured as string[])).toContain("plans");
  });

  it("清空语义一致性：容器型包(packs)仅含 version 时同样回到未配置", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    await updateQuotaPacks({ version: 1 }, "platform_admin");

    const [, insertParams] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(JSON.parse(String(insertParams[3]))).toEqual({ version: 1 });

    mocks.queryOne.mockResolvedValueOnce({ id: 12, config_value: String(insertParams[3]) });
    const after = await getQuotaPacks();
    expect(after._configured).toBe(false);
    expect((after._unconfigured as string[])).toContain("packs");
  });

  it("部分更新：PUT 只传 points(不带 tokens/enabled) 落库成功，GET _unconfigured 含 tokens/enabled", async () => {
    mocks.queryOne.mockResolvedValueOnce(null); // 不存在 → INSERT
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    await updatePointsRate({ version: 1, points: 1 }, "platform_admin");

    const [, insertParams] = mocks.query.mock.calls[0] as [string, unknown[]];
    const stored = JSON.parse(String(insertParams[3]));
    expect(stored.points).toBe(1);
    expect("tokens" in stored).toBe(false);
    expect("enabled" in stored).toBe(false);

    mocks.queryOne.mockResolvedValueOnce({ id: 10, config_value: String(insertParams[3]) });
    const after = await getPointsRate();
    expect(after.points).toBe(1);
    expect((after._unconfigured as string[])).toContain("tokens");
    expect((after._unconfigured as string[])).toContain("enabled");
    expect(after._configured).toBe(true);
  });
});
