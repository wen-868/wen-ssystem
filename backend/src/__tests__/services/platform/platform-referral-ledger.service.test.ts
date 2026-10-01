/**
 * R101-C6-3-2b：老带新台账服务（t_referral_ledger，迁移 195）
 *
 * 对应卡内验收标准②③⑤：
 * - 上限口径：`applyAnnualRewardCap` 的截断边界（剩余额度充足 / 部分截断 / 额度用尽记 0 分）；
 * - 唯一约束：一被邀请租户一条（先查 409 + 并发 ER_DUP_ENTRY 409）；
 * - 口径常量：20% 与 60000 逐字钉死，状态枚举与迁移列注释一致；
 * - 零金额：SQL 只碰 t_referral_ledger / t_tenant，不碰任何金额表。
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
  REFERRAL_ANNUAL_CAP_POINTS,
  REFERRAL_LEDGER_STATUSES,
  REFERRAL_REWARD_BASIS_SUBSCRIBE,
  REFERRAL_REWARD_RATE,
  applyAnnualRewardCap,
  computeReferralRewardPoints,
  listReferralLedger,
  referralYearOf,
  referralYearRange,
  rewardBasisLabel,
  writeReferralLedgerEntry,
} from "../../../services/platform/platform-referral-ledger.service";

beforeEach(() => {
  vi.resetAllMocks();
});

function ledgerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    inviterTenantId: "tenant-inviter",
    inviterName: "华东总代",
    inviteeTenantId: "tenant-invitee",
    inviteeTenantCode: "T20261002001",
    inviteeName: "新客商行",
    rewardPoints: 1000,
    rewardBasis: REFERRAL_REWARD_BASIS_SUBSCRIBE,
    inviterYearPoints: 1000,
    status: "PENDING",
    grantedAt: null,
    remark: null,
    createdAt: "2026-10-02 10:00:00",
    updatedAt: "2026-10-02 10:00:00",
    ...overrides,
  };
}

describe("C6-3-2b · 口径常量（规划 4.9 逐字，不得自拟）", () => {
  it("奖励比例 20%、年度上限 60000、状态仅 PENDING/GRANTED/REVOKED", () => {
    expect(REFERRAL_REWARD_RATE).toBe(0.2);
    expect(REFERRAL_ANNUAL_CAP_POINTS).toBe(60000);
    expect([...REFERRAL_LEDGER_STATUSES]).toEqual(["PENDING", "GRANTED", "REVOKED"]);
    expect(REFERRAL_REWARD_BASIS_SUBSCRIBE).toBe("subscribe_amount");
  });

  it("口径展示名：subscribe_amount → 订阅实收；未知口径原样返回（不编造中文）", () => {
    expect(rewardBasisLabel("subscribe_amount")).toBe("订阅实收");
    expect(rewardBasisLabel("unknown_basis")).toBe("unknown_basis");
  });
});

describe("C6-3-2b · computeReferralRewardPoints（20% 口径）", () => {
  it("按 20% 向下取整：1000→200、999→199、5→1、0→0", () => {
    expect(computeReferralRewardPoints(1000)).toBe(200);
    expect(computeReferralRewardPoints(999)).toBe(199);
    expect(computeReferralRewardPoints(5)).toBe(1);
    expect(computeReferralRewardPoints(0)).toBe(0);
  });

  it("负数 / NaN / 非有限 ⇒ 400（不落 0 蒙混）", () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => computeReferralRewardPoints(bad)).toThrowError(
        expect.objectContaining({ statusCode: 400 })
      );
    }
  });
});

describe("C6-3-2b · applyAnnualRewardCap（年度上限 60000 的截断口径）", () => {
  it("额度充足 ⇒ 全额计入、不算截断", () => {
    const result = applyAnnualRewardCap(2000, 0);
    expect(result).toEqual({
      requestedPoints: 2000,
      usedPoints: 0,
      remainingPoints: 60000,
      grantedPoints: 2000,
      capped: false,
      capReason: null,
    });
  });

  it("累计将超过 60000 ⇒ 按剩余额度截断（2000 请求 / 已计 59500 ⇒ 只计 500）", () => {
    const result = applyAnnualRewardCap(2000, 59500);
    expect(result.grantedPoints).toBe(500);
    expect(result.remainingPoints).toBe(500);
    expect(result.capped).toBe(true);
    expect(result.capReason).toContain("截断");
    expect(result.capReason).toContain("60000");
  });

  it("额度用尽 ⇒ 记 0 分 + 原因（不是失败、也不是负数）", () => {
    const result = applyAnnualRewardCap(2000, 60000);
    expect(result.grantedPoints).toBe(0);
    expect(result.remainingPoints).toBe(0);
    expect(result.capped).toBe(true);
    expect(result.capReason).toContain("记 0 分");
  });

  it("历史已超上限（如人工订正过）⇒ 仍然只记 0 分，不出现负额度", () => {
    const result = applyAnnualRewardCap(2000, 61000);
    expect(result.remainingPoints).toBe(0);
    expect(result.grantedPoints).toBe(0);
  });

  it("边界：恰好补齐到 60000（请求 500 / 已计 59500）⇒ 计满、不截断", () => {
    const result = applyAnnualRewardCap(500, 59500);
    expect(result.grantedPoints).toBe(500);
    expect(result.capped).toBe(false);
    expect(result.capReason).toBeNull();
  });
});

describe("C6-3-2b · 年度窗口（created_at 自然年）", () => {
  it("referralYearRange：半开区间 [年初, 次年初)", () => {
    expect(referralYearRange(2026)).toEqual({
      from: "2026-01-01 00:00:00",
      to: "2027-01-01 00:00:00",
    });
  });

  it("referralYearOf：按本地自然年取年；非法入参 ⇒ 400", () => {
    expect(referralYearOf("2026-03-05 10:00:00")).toBe(2026);
    expect(() => referralYearOf("not-a-date")).toThrowError(
      expect.objectContaining({ statusCode: 400 })
    );
    expect(() => referralYearRange(0)).toThrowError(expect.objectContaining({ statusCode: 400 }));
  });
});

describe("C6-3-2b · listReferralLedger（分页 + 关键词 + 状态，只读）", () => {
  it("空表 ⇒ items: []、total 0（零预置，不由代码兜出假行）", async () => {
    mocks.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
    const result = await listReferralLedger({});
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });

    const countSql = String(mocks.query.mock.calls[0][0]);
    expect(countSql).toContain("COUNT(*)");
    expect(countSql).toContain("t_referral_ledger");
    for (const word of ["INSERT", "UPDATE", "DELETE"]) {
      expect(countSql.toUpperCase()).not.toContain(word);
    }
    for (const word of ["t_subscription", "t_settlement", "t_withdraw", "commission"]) {
      expect(countSql).not.toContain(word);
    }
  });

  it("关键词命中 7 列 + 状态，参数顺序与分页正确", async () => {
    mocks.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([ledgerRow()]);
    const result = await listReferralLedger({
      page: 2,
      pageSize: 5,
      keyword: " 华东 ",
      status: "PENDING",
    });
    expect(result.total).toBe(1);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(5);

    const listSql = String(mocks.query.mock.calls[1][0]);
    expect(listSql).toContain("l.inviter_tenant_id LIKE ?");
    expect(listSql).toContain("l.invitee_tenant_id LIKE ?");
    expect(listSql).toContain("l.invitee_tenant_code LIKE ?");
    expect(listSql).toContain("ti.tenant_name LIKE ?");
    expect(listSql).toContain("tn.tenant_name LIKE ?");
    expect(listSql).toContain("l.status = ?");
    expect(listSql).toContain("LIMIT ? OFFSET ?");
    expect(mocks.query.mock.calls[1][1]).toEqual([
      "%华东%",
      "%华东%",
      "%华东%",
      "%华东%",
      "%华东%",
      "%华东%",
      "%华东%",
      "PENDING",
      5,
      5,
    ]);
  });

  it("行归一：NULL 不折成空串、积分/累计归 number、口径给中文展示名", async () => {
    mocks.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([
      ledgerRow({
        id: "9",
        rewardPoints: "2600",
        inviterYearPoints: "3600",
        inviterName: null,
        inviteeName: null,
        inviteeTenantCode: null,
        remark: null,
      }),
    ]);
    const result = await listReferralLedger({});
    expect(result.items[0]).toMatchObject({
      id: 9,
      rewardPoints: 2600,
      inviterYearPoints: 3600,
      inviterName: null,
      inviteeName: null,
      inviteeTenantCode: null,
      remark: null,
      rewardBasisLabel: "订阅实收",
    });
  });

  it("邀请人年度累计走独立预聚合（status<>'REVOKED' 口径），不受列表过滤条件污染", async () => {
    mocks.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
    await listReferralLedger({ status: "PENDING" });
    const listSql = String(mocks.query.mock.calls[1][0]);
    expect(listSql).toContain("inviterYearPoints");
    expect(listSql).toContain("status <> 'REVOKED'");
    expect(listSql).toContain("GROUP BY inviter_tenant_id, YEAR(created_at)");
    expect(listSql).toContain("y.referralYear = YEAR(l.created_at)");
  });
});

describe("C6-3-2b · writeReferralLedgerEntry（唯一写入口，无对外端点）", () => {
  it("缺邀请人 / 缺被邀请人 / 自邀自奖 / 口径不支持 / 基数非法 ⇒ 400，且不发生任何查询", async () => {
    await expect(
      writeReferralLedgerEntry({ inviterTenantId: " ", inviteeTenantId: "b", basisUnits: 1 })
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      writeReferralLedgerEntry({ inviterTenantId: "a", inviteeTenantId: "", basisUnits: 1 })
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      writeReferralLedgerEntry({ inviterTenantId: "a", inviteeTenantId: "a", basisUnits: 1 })
    ).rejects.toMatchObject({ statusCode: 400, message: "邀请人与被邀请人不能是同一租户" });
    await expect(
      writeReferralLedgerEntry({
        inviterTenantId: "a",
        inviteeTenantId: "b",
        basisUnits: 1,
        rewardBasis: "made_up_basis",
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      writeReferralLedgerEntry({ inviterTenantId: "a", inviteeTenantId: "b", basisUnits: -1 })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.queryOne).not.toHaveBeenCalled();
  });

  it("被邀请租户已有台账行 ⇒ 409（一被邀请租户一条），且不 INSERT", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5 });
    await expect(
      writeReferralLedgerEntry({ inviterTenantId: "a", inviteeTenantId: "b", basisUnits: 1000 })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("并发撞唯一键（ER_DUP_ENTRY）⇒ 409，不落 500", async () => {
    mocks.queryOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ yearPoints: 0 });
    mocks.query.mockRejectedValueOnce(
      Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" })
    );
    await expect(
      writeReferralLedgerEntry({ inviterTenantId: "a", inviteeTenantId: "b", basisUnits: 1000 })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("正常登记：20% 计点、状态固定 PENDING、年度窗口按当前年、返回口径明细", async () => {
    const nowYear = new Date().getFullYear();
    mocks.queryOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ yearPoints: "0" });
    mocks.query.mockResolvedValueOnce({ insertId: 11 });

    const result = await writeReferralLedgerEntry({
      inviterTenantId: "tenant-a",
      inviteeTenantId: "tenant-b",
      inviteeTenantCode: "T20261002001",
      basisUnits: 1000,
    });

    expect(result).toMatchObject({
      id: 11,
      inviterTenantId: "tenant-a",
      inviteeTenantId: "tenant-b",
      requestedPoints: 200,
      usedPointsInYear: 0,
      remainingPoints: 60000,
      rewardPoints: 200,
      capped: false,
      capReason: null,
      rewardBasis: "subscribe_amount",
    });
    expect(result.yearRange).toEqual({
      from: `${nowYear}-01-01 00:00:00`,
      to: `${nowYear + 1}-01-01 00:00:00`,
    });

    const yearSql = String(mocks.queryOne.mock.calls[1][0]);
    expect(yearSql).toContain("SUM(reward_points)");
    expect(yearSql).toContain("status <> 'REVOKED'");
    expect(mocks.queryOne.mock.calls[1][1]).toEqual([
      "tenant-a",
      `${nowYear}-01-01 00:00:00`,
      `${nowYear + 1}-01-01 00:00:00`,
    ]);

    const insertSql = String(mocks.query.mock.calls[0][0]);
    expect(insertSql).toContain("INSERT INTO t_referral_ledger");
    expect(insertSql).toContain("'PENDING'");
    expect(mocks.query.mock.calls[0][1]).toEqual([
      "tenant-a",
      "tenant-b",
      "T20261002001",
      200,
      "subscribe_amount",
      null,
    ]);
  });

  it("上限截断：请求 2000 / 已计 59500 ⇒ 落库 500 分，remark 写清原因", async () => {
    mocks.queryOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ yearPoints: 59500 });
    mocks.query.mockResolvedValueOnce({ insertId: 12 });

    const result = await writeReferralLedgerEntry({
      inviterTenantId: "tenant-a",
      inviteeTenantId: "tenant-c",
      basisUnits: 10000,
    });

    expect(result.requestedPoints).toBe(2000);
    expect(result.rewardPoints).toBe(500);
    expect(result.capped).toBe(true);
    expect(result.capReason).toContain("截断");
    const insertParams = mocks.query.mock.calls[0][1] as unknown[];
    expect(insertParams[3]).toBe(500);
    expect(String(insertParams[5])).toContain("上限");
  });

  it("额度用尽：已计 60000 ⇒ 落库 0 分 + remark 写明不再累计", async () => {
    mocks.queryOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ yearPoints: 60000 });
    mocks.query.mockResolvedValueOnce({ insertId: 13 });

    const result = await writeReferralLedgerEntry({
      inviterTenantId: "tenant-a",
      inviteeTenantId: "tenant-d",
      basisUnits: 10000,
    });

    expect(result.rewardPoints).toBe(0);
    expect(result.capped).toBe(true);
    const insertParams = mocks.query.mock.calls[0][1] as unknown[];
    expect(insertParams[3]).toBe(0);
    expect(String(insertParams[5])).toContain("记 0 分");
  });

  it("occurredAt 决定年度窗口，并显式写 created_at（跨年归属可复算）", async () => {
    mocks.queryOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ yearPoints: 0 });
    mocks.query.mockResolvedValueOnce({ insertId: 14 });

    const result = await writeReferralLedgerEntry({
      inviterTenantId: "tenant-a",
      inviteeTenantId: "tenant-e",
      basisUnits: 1000,
      occurredAt: "2025-12-31 23:59:59",
    });

    expect(result.yearRange).toEqual({
      from: "2025-01-01 00:00:00",
      to: "2026-01-01 00:00:00",
    });
    expect(mocks.queryOne.mock.calls[1][1]).toEqual([
      "tenant-a",
      "2025-01-01 00:00:00",
      "2026-01-01 00:00:00",
    ]);
    const insertSql = String(mocks.query.mock.calls[0][0]);
    expect(insertSql).toContain("created_at");
    const insertParams = mocks.query.mock.calls[0][1] as unknown[];
    expect(insertParams[insertParams.length - 1]).toBe("2025-12-31 23:59:59");
  });

  it("未取得主键 ⇒ 500（不返回编造的 id）", async () => {
    mocks.queryOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ yearPoints: 0 });
    mocks.query.mockResolvedValueOnce({});
    await expect(
      writeReferralLedgerEntry({ inviterTenantId: "a", inviteeTenantId: "b", basisUnits: 1000 })
    ).rejects.toMatchObject({ statusCode: 500 });
  });
});
