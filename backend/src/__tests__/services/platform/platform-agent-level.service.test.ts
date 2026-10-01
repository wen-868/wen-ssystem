/**
 * R101-C6-3-3：平台代理商层级权益配置服务（t_agent_level，迁移 187）
 *
 * 口径（对应派单卡 §三② / §四 / D11 三项 / 验收标准②③）：
 * - D11① 分润比例配置化：未配置 ⇒ NULL（**不得写 0 冒充**）；
 * - D11② 增值初期关闭：profit_mode_upsell 建行默认 0，新签/续费默认 1；
 * - D11③ 层级自定义命名：level_name 自由命名，服务层不写死"一级/二级"，且零预置（空表 ⇒ items: []）；
 * - plan_scope：planId 数组；未配置 ⇒ NULL（不写空数组冒充）；
 * - 折扣区间：两者都配置时上限不得低于下限 ⇒ 400；
 * - level_code 重复 ⇒ 409；未知 id ⇒ 404；无字段变更 ⇒ 400；
 * - 零涉钱：SQL 只碰 t_agent_level，不出现任何金额/计提/结算表。
 */
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
  AGENT_LEVEL_STATUSES,
  assertDiscountRange,
  listAgentLevels,
  createAgentLevel,
  updateAgentLevel,
} from "../../../services/platform/platform-agent-level.service";

beforeEach(() => {
  vi.resetAllMocks();
});

function levelRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    levelCode: "level_a",
    levelName: "自定义甲级",
    allowSubLevel: 1,
    planScope: null,
    discountLow: null,
    discountHigh: null,
    profitModeSignup: 1,
    profitModeRenew: 1,
    profitModeUpsell: 0,
    profitRateSignup: null,
    profitRateRenew: null,
    profitRateUpsell: null,
    sortNo: 0,
    status: "ACTIVE",
    ...overrides,
  };
}

describe("C6-3-3 · 常量与折扣区间护栏", () => {
  it("层级状态为 ACTIVE/DISABLED（与 184/185 平台级表同口径）", () => {
    expect([...AGENT_LEVEL_STATUSES]).toEqual(["ACTIVE", "DISABLED"]);
  });

  it("折扣区间：任一为 null 不判（未配置不参与比较、也不当 0），high < low ⇒ 400", () => {
    expect(() => assertDiscountRange(null, 8.8)).not.toThrow();
    expect(() => assertDiscountRange(7.5, null)).not.toThrow();
    expect(() => assertDiscountRange(null, null)).not.toThrow();
    expect(() => assertDiscountRange(7.5, 8.8)).not.toThrow();
    expect(() => assertDiscountRange(8.8, 7.5)).toThrowError("拿货折扣区间不合法：上限 7.5 低于下限 8.8");
  });
});

describe("C6-3-3 · listAgentLevels", () => {
  it("空表 ⇒ items: []（零预置，不由代码兜出「一级/二级」假行）", async () => {
    mocks.query.mockResolvedValueOnce([]);
    const result = await listAgentLevels();
    expect(result).toEqual({ items: [] });
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("t_agent_level");
    expect(sql).toContain("ORDER BY sort_no ASC");
    expect(sql).not.toContain("t_platform_config");
  });

  it("JSON 列两种形态都能解析（字符串 / 已解析数组）；NULL 保持 null", async () => {
    mocks.query.mockResolvedValueOnce([
      levelRow({ id: 1, planScope: "[1,2]" }),
      levelRow({ id: 2, planScope: [3], discountLow: "7.50", profitRateSignup: "12.5000" }),
      levelRow({ id: 3, planScope: null, discountLow: null, profitRateSignup: null }),
    ]);
    const result = await listAgentLevels();
    expect(result.items[0].planScope).toEqual([1, 2]);
    expect(result.items[1].planScope).toEqual([3]);
    // DECIMAL 回读为字符串 ⇒ 归一为 number；未配置保持 null（**不是 0**）
    expect(result.items[1].discountLow).toBe(7.5);
    expect(result.items[1].profitRateSignup).toBe(12.5);
    expect(result.items[2].planScope).toBeNull();
    expect(result.items[2].discountLow).toBeNull();
    expect(result.items[2].profitRateSignup).toBeNull();
  });

  it("脏值（planScope 非数组 JSON）⇒ null，不编造范围", async () => {
    mocks.query.mockResolvedValueOnce([levelRow({ planScope: "{}" }), levelRow({ planScope: "not-json" })]);
    const result = await listAgentLevels();
    expect(result.items[0].planScope).toBeNull();
    expect(result.items[1].planScope).toBeNull();
  });
});

describe("C6-3-3 · createAgentLevel", () => {
  it("levelCode 重复 ⇒ 409，且不 INSERT", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1 });
    await expect(
      createAgentLevel({ levelCode: "level_a", levelName: "甲级" })
    ).rejects.toMatchObject({ statusCode: 409, message: "层级编码已存在：level_a" });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("折扣区间倒挂 ⇒ 400，且不 INSERT", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(
      createAgentLevel({ levelCode: "level_b", levelName: "乙级", discountLow: 9, discountHigh: 8 })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("合法 ⇒ D11 默认值：增值关闭(0)/新签续费开(1)、未配置比例落 NULL、planScope 存 JSON 字符串", async () => {
    mocks.queryOne
      .mockResolvedValueOnce(null) // 编码未占用
      .mockResolvedValueOnce(levelRow({ id: 5, planScope: "[1,2]" })); // 回读
    mocks.query.mockResolvedValueOnce({ insertId: 5 });

    const result = await createAgentLevel(
      { levelCode: "level_a", levelName: "自定义甲级", planScope: [1, 2], allowSubLevel: true },
      99
    );
    expect(result.id).toBe(5);

    const insertSql = String(mocks.query.mock.calls[0][0]);
    expect(insertSql).toContain("INSERT INTO t_agent_level");
    expect(mocks.query.mock.calls[0][1]).toEqual([
      "level_a",
      "自定义甲级",
      1, // allowSubLevel
      "[1,2]", // planScope 序列化为 JSON 字符串
      null, // discountLow 未配置 ⇒ NULL（不得写 0）
      null, // discountHigh 未配置 ⇒ NULL
      1, // profit_mode_signup 默认开
      1, // profit_mode_renew 默认开
      0, // profit_mode_upsell 默认关（D11②）
      null, // profit_rate_signup 未配置 ⇒ NULL
      null,
      null,
      0, // sort_no 默认 0
      "ACTIVE",
      99,
    ]);
  });

  it("并发撞唯一键（ER_DUP_ENTRY）⇒ 409，不落 500", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    mocks.query.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" }));
    await expect(
      createAgentLevel({ levelCode: "level_a", levelName: "甲级" })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("C6-3-3 · updateAgentLevel", () => {
  it("未知 id ⇒ 404，且不 UPDATE", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(updateAgentLevel(9, { levelName: "新名" })).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("无字段变更 ⇒ 400（不得静默成功）", async () => {
    mocks.queryOne.mockResolvedValueOnce(levelRow({ levelName: "自定义甲级", allowSubLevel: 1 }));
    await expect(
      updateAgentLevel(1, { levelName: "自定义甲级", allowSubLevel: true })
    ).rejects.toMatchObject({ statusCode: 400, message: "提交内容与当前层级配置一致，无字段变更" });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("折扣区间与现值合并后再判（只改上限也要判）", async () => {
    mocks.queryOne.mockResolvedValueOnce(levelRow({ discountLow: "8.00", discountHigh: "9.00" }));
    await expect(updateAgentLevel(1, { discountHigh: 7 })).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("部分更新 ⇒ 只写传了的字段 + updated_by，返回 changedFields（含 planScope 清空为 NULL）", async () => {
    mocks.queryOne.mockResolvedValueOnce(
      levelRow({ planScope: [1, 2], profitRateSignup: null, profitModeUpsell: 0 })
    );
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    const result = await updateAgentLevel(
      1,
      { planScope: null, profitRateSignup: 12.5, profitModeUpsell: true },
      55
    );
    expect(result).toEqual({
      id: 1,
      changedFields: ["planScope", "profitRateSignup", "profitModeUpsell"],
    });

    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("plan_scope = ?");
    expect(sql).toContain("profit_rate_signup = ?");
    expect(sql).toContain("profit_mode_upsell = ?");
    expect(sql).toContain("updated_by = ?");
    expect(mocks.query.mock.calls[0][1]).toEqual([null, 12.5, 1, 55, 1]);
  });
});
