/**
 * 会员积分真源统一口径单测（TOTAL-MEMBER-POINTS-TRUTH-SOURCE-01）
 * 被测文件：src/services/admin/points.service.ts 的单点收口部分
 *   - MEMBER_POINTS_TRUTH_JOIN_SQL / MEMBER_POINTS_TRUTH_AVAILABLE_SQL（回退规则唯一实现）
 *   - getMemberPointsTruth（列表/详情/积分接口共用的单点读取函数）
 * COALESCE 回退语义的真实 MySQL 验证见本卡真库 harness（evidence raw）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import {
  MEMBER_POINTS_TRUTH_JOIN_SQL,
  MEMBER_POINTS_TRUTH_AVAILABLE_SQL,
  getMemberPointsTruth,
} from "../../../services/admin/points.service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("points.service - 会员积分真源统一口径（单点收口）", () => {
  it("回退规则片段唯一：优先账户 available_points，无账户回退遗留列 m.points", () => {
    expect(MEMBER_POINTS_TRUTH_AVAILABLE_SQL).toBe("COALESCE(cp.available_points, m.points, 0)");
  });

  it("JOIN 片段带租户边界：cp.tenant_id = m.tenant_id", () => {
    expect(MEMBER_POINTS_TRUTH_JOIN_SQL).toBe(
      "LEFT JOIN t_customer_points cp ON cp.customer_id = m.id AND cp.tenant_id = m.tenant_id"
    );
  });

  it("getMemberPointsTruth：SQL 复用单点片段并带 m.tenant_id 谓词", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ availablePoints: 120, totalPoints: 300, frozenPoints: 10 });
    const truth = await getMemberPointsTruth("t1", 7);
    expect(truth).toEqual({ availablePoints: 120, totalPoints: 300, frozenPoints: 10 });
    const [sql, params, tenantId] = mocks.queryOneWithTenant.mock.calls[0];
    expect(String(sql)).toContain("COALESCE(cp.available_points, m.points, 0) AS availablePoints");
    expect(String(sql)).toContain("FROM t_member m");
    expect(String(sql)).toContain("LEFT JOIN t_customer_points cp ON cp.customer_id = m.id AND cp.tenant_id = m.tenant_id");
    expect(String(sql)).toContain("m.tenant_id = ?");
    // 参数绑定（SQL 一律参数绑定，禁止拼接值）
    expect(params).toEqual([7, "t1"]);
    expect(tenantId).toBe("t1");
  });

  it("getMemberPointsTruth：数值字符串归一化为 number", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ availablePoints: "88", totalPoints: "200", frozenPoints: "5" });
    const truth = await getMemberPointsTruth("t1", 7);
    expect(truth).toEqual({ availablePoints: 88, totalPoints: 200, frozenPoints: 5 });
    expect(typeof truth?.availablePoints).toBe("number");
  });

  it("getMemberPointsTruth：无账户回退行（COALESCE 落到 m.points）仍返回该兼容值", async () => {
    // 无账户时 cp.* 为 NULL：availablePoints=COALESCE→m.points，totalPoints 回退 available，frozen 归 0
    mocks.queryOneWithTenant.mockResolvedValueOnce({ availablePoints: 66, totalPoints: null, frozenPoints: null });
    const truth = await getMemberPointsTruth("t1", 7);
    expect(truth).toEqual({ availablePoints: 66, totalPoints: 66, frozenPoints: 0 });
  });

  it("getMemberPointsTruth：会员不存在返回 null（调用方决定 404）", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    expect(await getMemberPointsTruth("t1", 999)).toBeNull();
  });
});
