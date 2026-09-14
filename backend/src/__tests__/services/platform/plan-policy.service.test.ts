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
  getPlanPolicy,
  updatePlanPolicy,
} from "../../../services/platform/plan-policy.service";

/**
 * R101-S2-02 组1：套餐策略包（t_platform_config, config_key='plan_policy:<planId>'）
 * 护栏③：包必须带 version 且经 zod 校验；护栏④：未配置≠已配置，元字段与 null 不得回写。
 */
describe("platform/plan-policy.service（R101-S2-02 组1）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("未配置时：返回全部键未配置，不补默认值冒充已生效", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    const policy = await getPlanPolicy(12);
    expect(policy._configured).toBe(false);
    expect(policy._unconfigured).toEqual([
      "quota",
      "upgrade",
      "downgrade",
      "renew",
      "promo",
    ]);
    expect(policy.version).toBe(1);
    // 查询键必须与契约一致（platform='SAAS'）
    const [sql, params] = mocks.queryOne.mock.calls[0] as [string, unknown[]];
    expect(params[0]).toBe("plan_policy:12");
    expect(params[1]).toBe("SAAS");
    expect(sql).toContain("t_platform_config");
  });

  it("已配置部分键时：_unconfigured 仅列未配置的键", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      id: 3,
      config_value: JSON.stringify({ version: 1, upgrade: { mode: "IMMEDIATE" } }),
    });
    const policy = await getPlanPolicy(12);
    expect(policy._configured).toBe(true);
    expect(policy._unconfigured).not.toContain("upgrade");
    expect(policy._unconfigured).toContain("quota");
    expect((policy.upgrade as { mode: string }).mode).toBe("IMMEDIATE");
  });

  it("保存：config_key 按 planId 隔离，且落平台 KV 行（platform/tenant_id/category）", async () => {
    mocks.queryOne.mockResolvedValueOnce(null); // 不存在 → INSERT
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    await updatePlanPolicy(12, { upgrade: { mode: "NEXT_CYCLE" } }, "platform_admin");

    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO t_platform_config");
    // 注意：store_id 是 SQL 字面量 NULL，不占参数位
    // 参数序：platform, tenant_id, config_key, config_value, category, description, updated_by
    expect(params[0]).toBe("SAAS"); // platform
    expect(params[1]).toBe("platform"); // tenant_id
    expect(params[2]).toBe("plan_policy:12"); // config_key
    expect(params[4]).toBe("plan"); // category
    expect(params[6]).toBe("platform_admin"); // updated_by（护栏③审计）
    const json = JSON.parse(String(params[3]));
    expect(json.version).toBe(1);
    expect(json.upgrade.mode).toBe("NEXT_CYCLE");
  });

  it("护栏④：null 与 _ 前缀元字段不落库（清空即回到未配置语义）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5 });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    await updatePlanPolicy(
      12,
      { upgrade: null, _unconfigured: ["upgrade", "quota"], _configured: false } as Record<
        string,
        unknown
      >,
      "platform_admin"
    );

    const params = mocks.query.mock.calls[0][1] as unknown[];
    const json = JSON.parse(String(params[0]));
    expect("upgrade" in json).toBe(false);
    expect("_unconfigured" in json).toBe(false);
    expect("_configured" in json).toBe(false);
    expect(json).toEqual({ version: 1 });
  });

  it("护栏③：非法结构直接拒绝（不落脏配置）", async () => {
    await expect(
      updatePlanPolicy(12, { upgrade: { mode: "INSTANT" } }, "platform_admin")
    ).rejects.toThrow();
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
