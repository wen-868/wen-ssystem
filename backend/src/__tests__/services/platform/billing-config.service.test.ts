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
  getArrearsPolicy,
  updateArrearsPolicy,
  getAddonPrice,
  updateAddonPrice,
} from "../../../services/platform/billing-config.service";

/**
 * R101-S2-02 组2：账单类配置包（t_platform_config）
 * 护栏③：zod + version；护栏④：未配置≠已配置，元字段与 null 不回写。
 */
describe("platform/billing-config.service（R101-S2-02 组2）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("欠费策略未配置：_configured=false 且不补任何默认天数", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    const p = await getArrearsPolicy();
    expect(p._configured).toBe(false);
    expect((p._unconfigured as string[]).length).toBeGreaterThan(0);
    expect(p.graceDays).toBeUndefined();
    expect(p.retainDays).toBeUndefined();
    const [, params] = mocks.queryOne.mock.calls[0] as [string, unknown[]];
    expect(params[0]).toBe("billing:arrears_policy");
    expect(params[1]).toBe("SAAS");
  });

  it("欠费策略已配置部分键：_unconfigured 只列未配置的键", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      id: 1,
      config_value: JSON.stringify({ version: 1, graceDays: 15 }),
    });
    const p = await getArrearsPolicy();
    expect(p._configured).toBe(true);
    expect(p._unconfigured).not.toContain("graceDays");
    expect(p._unconfigured).toContain("retainDays");
    expect(p.graceDays).toBe(15);
  });

  it("保存欠费策略：落 billing:arrears_policy，写 updated_by 与 category=billing", async () => {
    mocks.queryOne.mockResolvedValueOnce(null); // 不存在 → INSERT
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    await updateArrearsPolicy({ graceDays: 15, channels: ["IN_APP"] }, "platform_admin");

    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO t_platform_config");
    // 参数序：platform, tenant_id, config_key, config_value, category, description, updated_by
    expect(params[0]).toBe("SAAS");
    expect(params[2]).toBe("billing:arrears_policy");
    expect(params[4]).toBe("billing");
    expect(params[6]).toBe("platform_admin");
    const json = JSON.parse(String(params[3]));
    expect(json.version).toBe(1);
    expect(json.graceDays).toBe(15);
  });

  it("护栏④：null 与 _ 前缀元字段不落库（清空即回到未配置语义）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 4 });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    await updateArrearsPolicy(
      { graceDays: null, _unconfigured: ["graceDays"], _configured: false } as Record<
        string,
        unknown
      >,
      "platform_admin"
    );

    const params = mocks.query.mock.calls[0][1] as unknown[];
    const json = JSON.parse(String(params[0]));
    expect("graceDays" in json).toBe(false);
    expect("_unconfigured" in json).toBe(false);
    expect(json).toEqual({ version: 1 });
  });

  it("护栏③：非法结构直接拒绝，不落脏配置", async () => {
    await expect(
      updateArrearsPolicy({ channels: ["站内"] }, "platform_admin")
    ).rejects.toThrow();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("增值单价：读写走 billing:addon_price，未配置时单价为 undefined", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    const a = await getAddonPrice();
    expect(a._configured).toBe(false);
    expect(a.storagePerGbMonth).toBeUndefined();

    mocks.queryOne.mockResolvedValueOnce(null); // 不存在 → INSERT
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });
    await updateAddonPrice({ apiPer10k: 50 }, "platform_admin");
    const params = mocks.query.mock.calls[0][1] as unknown[];
    // 参数序：platform, tenant_id, config_key, config_value, category, description, updated_by
    expect(params[2]).toBe("billing:addon_price");
    expect(params[4]).toBe("billing");
    expect(JSON.parse(String(params[3])).apiPer10k).toBe(50);
  });
});
