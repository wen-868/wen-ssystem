/**
 * R101-C6-3-2b：渠道效果报表服务（按归因维度聚合）
 *
 * 对应卡内验收标准③④⑤：
 * - 聚合口径可复算：同一份 fixture（等价装置）下，"手算/脚本复算"的明细与合计必须与本服务一致；
 * - 空态诚实：无归因数据 ⇒ items: []（不造数）；
 * - 口径与过滤条件随响应返回（basis / filters），且 SQL 与口径常量逐字对应。
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
  CHANNEL_EFFECT_BASIS,
  getChannelEffectReport,
  toChannelEffectItem,
} from "../../../services/platform/platform-channel-report.service";

beforeEach(() => {
  vi.resetAllMocks();
});

/**
 * 等价装置 fixture（= 验收标准③ 的"同一份输入"）：
 * 3 条归因维度明细行 + 1 项无归因行。数字用手算表核对（见本文件末段"手算复算"）。
 */
const FIXTURE_ROWS = [
  {
    dimension: "PROMO",
    agentId: null,
    agentName: null,
    promoCodeId: 3,
    promoCode: "PCAAAAAAAA",
    channelType: "地推",
    channelName: "华东地推",
    tenantCount: "4",
    referralCount: "0",
    rewardPoints: "0",
  },
  {
    dimension: "AGENT",
    agentId: 7,
    agentName: "华东总代",
    promoCodeId: null,
    promoCode: null,
    channelType: null,
    channelName: null,
    tenantCount: "2",
    referralCount: "1",
    rewardPoints: "2600",
  },
  {
    dimension: "REFERRAL",
    agentId: null,
    agentName: null,
    promoCodeId: null,
    promoCode: null,
    channelType: null,
    channelName: null,
    tenantCount: "1",
    referralCount: "1",
    rewardPoints: "1000",
  },
];

/** 手算表（与 fixture 同一份输入，脚本/人工独立算出来的期望值） */
const HAND_COMPUTED = {
  tenantCount: 4 + 2 + 1,
  referralCount: 0 + 1 + 1,
  rewardPoints: 0 + 2600 + 1000,
};

describe("C6-3-2b · 空态诚实（验收④）", () => {
  it("无归因数据 ⇒ items: []、totals 全 0，且口径说明仍随响应返回", async () => {
    mocks.query.mockResolvedValueOnce([]);
    const report = await getChannelEffectReport({});
    expect(report.items).toEqual([]);
    expect(report.totals).toEqual({ tenantCount: 0, referralCount: 0, rewardPoints: 0 });
    expect(report.filters).toEqual({ attributionType: null, channelType: null });
    expect(report.basis).toEqual(CHANNEL_EFFECT_BASIS);
    expect(report.basis.emptyState).toContain("items: []");

    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("FROM t_tenant_attribution");
    for (const word of ["INSERT", "UPDATE", "DELETE"]) {
      expect(sql.toUpperCase()).not.toContain(word);
    }
    // 零金额（红线①）：不读订阅表、不算佣金/分润/结算
    for (const word of ["t_subscription", "t_settlement", "t_withdraw", "commission"]) {
      expect(sql).not.toContain(word);
    }
  });
});

describe("C6-3-2b · 聚合口径可复算（验收③）", () => {
  it("同一份 fixture：服务明细 + 合计 = 手算表（逐项相等）", async () => {
    mocks.query.mockResolvedValueOnce(FIXTURE_ROWS);
    const report = await getChannelEffectReport({});

    // 明细：MySQL 回字符串，服务归一为 number；NULL 保持 null（不折成 0 / 空串）
    expect(report.items).toEqual([
      {
        dimension: "PROMO",
        agentId: null,
        agentName: null,
        promoCodeId: 3,
        promoCode: "PCAAAAAAAA",
        channelType: "地推",
        channelName: "华东地推",
        tenantCount: 4,
        referralCount: 0,
        rewardPoints: 0,
      },
      {
        dimension: "AGENT",
        agentId: 7,
        agentName: "华东总代",
        promoCodeId: null,
        promoCode: null,
        channelType: null,
        channelName: null,
        tenantCount: 2,
        referralCount: 1,
        rewardPoints: 2600,
      },
      {
        dimension: "REFERRAL",
        agentId: null,
        agentName: null,
        promoCodeId: null,
        promoCode: null,
        channelType: null,
        channelName: null,
        tenantCount: 1,
        referralCount: 1,
        rewardPoints: 1000,
      },
    ]);

    // 合计 = 手算表（不重复计数：一租户一条归因 uk_tenant_attr）
    expect(report.totals).toEqual(HAND_COMPUTED);
    expect(report.totals.tenantCount).toBe(7);
    expect(report.totals.referralCount).toBe(2);
    expect(report.totals.rewardPoints).toBe(3600);
  });

  it("SQL 与口径常量逐字对应（COUNT(DISTINCT tenant_id) / REFERRAL 计数 / 排除 REVOKED）", async () => {
    mocks.query.mockResolvedValueOnce([]);
    await getChannelEffectReport({});
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("COUNT(DISTINCT a.tenant_id) AS tenantCount");
    expect(sql).toContain("SUM(CASE WHEN a.attribution_type = 'REFERRAL' THEN 1 ELSE 0 END) AS referralCount");
    expect(sql).toContain("l.status <> 'REVOKED'");
    expect(sql).toContain("LEFT JOIN t_referral_ledger l ON l.invitee_tenant_id = a.tenant_id");
    expect(sql).toContain("GROUP BY a.attribution_type, a.agent_id, g.agent_name, a.promo_code_id");
    expect(CHANNEL_EFFECT_BASIS.rewardRate).toBe(0.2);
    expect(CHANNEL_EFFECT_BASIS.annualCapPoints).toBe(60000);
    expect(CHANNEL_EFFECT_BASIS.scope).toContain("只读聚合");
  });

  it("toChannelEffectItem 纯映射：单行 fixture ⇒ 期望项（可单独喂给自检脚本）", () => {
    expect(toChannelEffectItem(FIXTURE_ROWS[1])).toEqual({
      dimension: "AGENT",
      agentId: 7,
      agentName: "华东总代",
      promoCodeId: null,
      promoCode: null,
      channelType: null,
      channelName: null,
      tenantCount: 2,
      referralCount: 1,
      rewardPoints: 2600,
    });
  });
});

describe("C6-3-2b · 过滤条件（写进响应，验收③口径说明）", () => {
  it("不传过滤 ⇒ 无 WHERE，filters 全 null", async () => {
    mocks.query.mockResolvedValueOnce([]);
    const report = await getChannelEffectReport({});
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).not.toContain("WHERE");
    expect(report.filters).toEqual({ attributionType: null, channelType: null });
    expect(mocks.query.mock.calls[0][1]).toEqual([]);
  });

  it("空串归一为「不过滤」（不产生 `= ''` 的假过滤）", async () => {
    mocks.query.mockResolvedValueOnce([]);
    const report = await getChannelEffectReport({ attributionType: "  ", channelType: "" });
    expect(String(mocks.query.mock.calls[0][0])).not.toContain("WHERE");
    expect(report.filters).toEqual({ attributionType: null, channelType: null });
  });

  it("attributionType + channelType ⇒ 两条 WHERE，参数顺序正确且 filters 回显", async () => {
    mocks.query.mockResolvedValueOnce([]);
    const report = await getChannelEffectReport({ attributionType: "PROMO", channelType: "地推" });
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("WHERE a.attribution_type = ? AND p.channel_type = ?");
    expect(mocks.query.mock.calls[0][1]).toEqual(["PROMO", "地推"]);
    expect(report.filters).toEqual({ attributionType: "PROMO", channelType: "地推" });
  });

  it("非法 attributionType ⇒ 400，且不查库", async () => {
    await expect(getChannelEffectReport({ attributionType: "FOO" })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
