import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

import {
  getPointsRule,
  updatePointsRule,
  getUserPoints,
  listPointsRecords,
  listMyPointsRecords,
  getPointsRecords,
  createPointsRedeem,
  getPointsStats,
} from "../../../services/admin/marketing-points.service";

const tenantId = "t1";

function mockRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    earnRatio: 1,
    redeemRatio: 100,
    minRedeemAmount: 0,
    maxRedeemRatio: 0.5,
    expireDays: 365,
    enabled: 1,
    createdAt: "2026-08-15",
    updatedAt: "2026-08-15",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("marketing-points.service - 积分规则与账户", () => {
  it("getPointsRule 返回规则", async () => {
    mocks.queryOneWithTenant.mockResolvedValue(mockRule());
    const rule = await getPointsRule(tenantId);
    expect(rule?.earnRatio).toBe(1);
  });

  it("updatePointsRule 已存在时部分更新", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce(mockRule({ earnRatio: 2 }));
    const rule = await updatePointsRule({ earnRatio: 2, enabled: false }, tenantId);
    expect(rule?.earnRatio).toBe(2);
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("UPDATE t_points_rule");
    expect(params).toEqual([2, 0, 1]);
  });

  it("updatePointsRule 不存在时插入默认规则（含 NOT NULL 的 rule_name / earn_type，S3-110 ④）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockRule());
    await updatePointsRule({}, tenantId);
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("INSERT INTO t_points_rule");
    // 回归保护（S3-110 ④）：t_points_rule.rule_name / earn_type 均 NOT NULL 且无默认值，
    // 漏列即 1364 ER_NO_DEFAULT_FOR_FIELD（严格模式）⇒ 列清单与参数必须成对带上这两列。
    expect(sql).toContain("rule_name");
    expect(sql).toContain("earn_type");
    expect(params).toEqual(["积分兑换规则", "purchase", 1, 100, 0, 0.5, 365, false, tenantId]);
    // S3-113 ①：缺省 earn_type 必须与前端标签映射键（小写 purchase/signin/birthday/referral）对齐，
    // 单钉一条值断言，防止只断言"非空"时被改回 'CONSUMPTION' 也不报错。
    expect(params[1]).toBe("purchase");
  });

  it("updatePointsRule 已存在时接住 ruleName / earnType（S3-113 ②：「收下却丢弃」回归保护）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce(mockRule());
    await updatePointsRule({ ruleName: "消费得积分", earnType: "signin" }, tenantId);
    const updateCall = mocks.queryWithTenant.mock.calls.find((c) => String(c[0]).includes("UPDATE t_points_rule"));
    expect(updateCall, "S3-113 ②：携带 ruleName/earnType 时必须发出 UPDATE").toBeDefined();
    const [sql, params] = updateCall!;
    expect(sql).toContain("rule_name = ?");
    expect(sql).toContain("earn_type = ?");
    expect(params).toEqual(["消费得积分", "signin", 1]);
  });

  it("updatePointsRule 已存在但未传 ruleName / earnType 时不得写这两列（S3-113 ②：存在才写）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce(mockRule({ earnRatio: 2 }));
    await updatePointsRule({ earnRatio: 2 }, tenantId);
    const updateCall = mocks.queryWithTenant.mock.calls.find((c) => String(c[0]).includes("UPDATE t_points_rule"));
    expect(updateCall, "S3-113 ②：只传 earnRatio 时 UPDATE 仍应发出").toBeDefined();
    const [sql, params] = updateCall!;
    expect(sql).not.toContain("rule_name");
    expect(sql).not.toContain("earn_type");
    expect(params).toEqual([2, 1]);
  });

  it("updatePointsRule 不存在时 ruleName / earnType 可被请求体覆盖（S3-110 ④）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockRule());
    await updatePointsRule({ ruleName: "消费得积分", earnType: "PURCHASE" }, tenantId);
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("INSERT INTO t_points_rule");
    expect(params.slice(0, 2)).toEqual(["消费得积分", "PURCHASE"]);
  });

  it("getUserPoints 无记录时返回零账户", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    const account = await getUserPoints(9, tenantId);
    expect(account).toEqual({ userId: 9, points: 0, totalEarned: 0, totalSpent: 0 });
  });

  it("listPointsRecords 带筛选分页", async () => {
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, points: 100 }]);
    const res = await listPointsRecords(1, 20, tenantId, 9, "EARN");
    expect(res.total).toBe(1);
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("user_id = ?");
    expect(sql).toContain("type = ?");
  });
});

// ===== Batch 5 扩展：我的积分明细 / 积分明细查询 / 兑换 / 统计 =====
describe("marketing-points.service - 我的积分明细", () => {
  it("listMyPointsRecords 分页返回", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, type: "EARN" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listMyPointsRecords(9, 1, 20, tenantId);
    expect(res.total).toBe(1);
    expect(res.records[0].type).toBe("EARN");
  });

  it("listMyPointsRecords 带 type 筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await listMyPointsRecords(9, 1, 20, tenantId, "SPEND");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("type = ?");
  });
});

describe("marketing-points.service - 积分明细查询", () => {
  it("getPointsRecords 带用户/类型筛选并关联会员名", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, userName: "张三" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await getPointsRecords({ tenantId, userId: 9, type: "EARN", page: 1, pageSize: 20 });
    expect(res.total).toBe(1);
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("user_id = ?");
    expect(sql).toContain("type = ?");
    expect(sql).toContain("LEFT JOIN t_member");
  });

  it("getPointsRecords 带日期范围", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await getPointsRecords({ tenantId, startDate: "2026-01-01", endDate: "2026-01-31", page: 1, pageSize: 20 });
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("created_at >= ?");
    expect(sql).toContain("created_at <= ?");
  });
});

describe("marketing-points.service - 积分兑换", () => {
  it("createPointsRedeem 余额充足 → 扣减并返回兑换额", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ userId: 9, points: 500 });
    mocks.queryOneWithTenant.mockResolvedValueOnce({ redeemRatio: 100 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 1 }]); // 扣减 UPDATE 命中 1 行（S3-65 起校验）
    const res = await createPointsRedeem({ tenantId, userId: 9, points: 200, remark: "换券" });
    expect(res.points).toBe(200);
    expect(res.redeemAmount).toBe(2); // floor(200/100)
    expect(res.balance).toBe(300);
    const upd = mocks.queryWithTenant.mock.calls.find((c) => String(c[0]).includes("UPDATE t_user_points"))!;
    expect(upd[1]).toEqual([300, 200, 9]);
  });

  it("createPointsRedeem 积分不足/账户不存在 → 抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null); // getUserPoints 返回默认零账户
    await expect(createPointsRedeem({ tenantId, userId: 9, points: 200 })).rejects.toThrow("积分不足");
  });

  it("createPointsRedeem 余额小于兑换额 → 抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ userId: 9, points: 100 });
    mocks.queryOneWithTenant.mockResolvedValueOnce({ redeemRatio: 100 });
    await expect(createPointsRedeem({ tenantId, userId: 9, points: 200 })).rejects.toThrow("积分不足");
  });

  it("createPointsRedeem 扣减 UPDATE 命中 0 行 → 抛 500 且不写流水（S3-65 档 1 · #19）", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ userId: 9, points: 500 });
    mocks.queryOneWithTenant.mockResolvedValueOnce({ redeemRatio: 100 });
    mocks.queryWithTenant.mockResolvedValue([{ affectedRows: 0 }]);
    await expect(createPointsRedeem({ tenantId, userId: 9, points: 200 })).rejects.toMatchObject({
      message: "积分兑换失败：未扣减任何积分（账户不存在、租户不匹配或记录已被删除）",
      statusCode: 500,
    });
    const wroteRecord = mocks.queryWithTenant.mock.calls.some((c) =>
      String(c[0]).includes("INSERT INTO t_points_record")
    );
    expect(wroteRecord).toBe(false);
  });
});

describe("marketing-points.service - 积分统计", () => {
  it("getPointsStats 返回四项统计", async () => {
    // 重置历史 mock 状态，避免前序用例的 mockResolvedValueOnce 残留影响断言
    mocks.queryOneWithTenant.mockReset();
    // totalPoints 取积分总和(SUM(points))，其余按 type / COUNT 区分
    mocks.queryOneWithTenant.mockImplementation(async (sql: string) => {
      const s = String(sql);
      if (s.includes("SUM(points)")) return { total: 1000 };
      if (s.includes("type = 'EARN'") || s.includes("type='EARN'")) return { total: 10 };
      if (s.includes("type = 'SPEND'") || s.includes("type='SPEND'")) return { total: 5 };
      if (s.includes("COUNT(*)")) return { total: 3 };
      return { total: 0 };
    });
    const res = await getPointsStats(tenantId);
    expect(res).toEqual({ totalPoints: 1000, todayEarned: 10, todaySpent: 5, userCount: 3 });
  });
});
