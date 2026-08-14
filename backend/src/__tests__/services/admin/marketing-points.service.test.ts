import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  query: vi.fn(),
  queryOne: vi.fn(),
}));

import {
  getPointsRule,
  updatePointsRule,
  getUserPoints,
  listPointsRecords,
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

  it("updatePointsRule 不存在时插入默认规则", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockRule());
    await updatePointsRule({}, tenantId);
    const [sql, params] = mocks.queryWithTenant.mock.calls[0];
    expect(sql).toContain("INSERT INTO t_points_rule");
    expect(params).toEqual([1, 100, 0, 0.5, 365, false, tenantId]);
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
