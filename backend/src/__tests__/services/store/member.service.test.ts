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
  listMemberManage,
  getMemberDetail,
  getMemberPoints,
  getMemberOrders,
} from "../../../services/store/member.service";
import { MEMBER_POINTS_TRUTH_AVAILABLE_SQL } from "../../../services/admin/points.service";

describe("store/member.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("getMemberDetail：返回会员详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 1, name: "张三", mobile: "13800000000", customer_type: "RETAIL", level_code: "VIP1",
    });
    const detail = await getMemberDetail("t1", 1);
    expect(detail?.name).toBe("张三");
  });

  it("getMemberDetail：积分来自真源统一口径（getMemberPointsTruth），不再读 m.points 兜底", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 1, name: "张三", mobile: "13800000000", customer_type: "RETAIL" }) // 会员行
      .mockResolvedValueOnce({ total: 0 }) // 累计消费
      .mockResolvedValueOnce({ availablePoints: 321, totalPoints: 500, frozenPoints: 7 }) // 积分真源
      .mockResolvedValueOnce(null); // 储值卡
    const detail = await getMemberDetail("t1", 1);
    expect(detail?.points).toBe(321);
    expect(detail?.totalPoints).toBe(500);
    expect(detail?.frozenPoints).toBe(7);
  });

  it("getMemberPoints：积分来自真源统一口径，与详情同值", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ availablePoints: 321, totalPoints: 500, frozenPoints: 7 });
    const points = await getMemberPoints("t1", 1);
    expect(points).toEqual({
      memberId: 1,
      points: 321,
      availablePoints: 321,
      totalPoints: 500,
      frozenPoints: 7,
    });
  });

  it("getMemberPoints：无缓存，账户调整后无需清缓存立即读到新值", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ availablePoints: 100, totalPoints: 100, frozenPoints: 0 }) // 调整前
      .mockResolvedValueOnce({ availablePoints: 150, totalPoints: 150, frozenPoints: 0 }); // 调整 +50 后
    expect((await getMemberPoints("t1", 5)).points).toBe(100);
    expect((await getMemberPoints("t1", 5)).points).toBe(150); // 第二次读必须拿到新值
  });

  it("getMemberPoints：会员不存在（真源 null）抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    await expect(getMemberPoints("t1", 999)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("listMemberManage：列表口径复用统一真源片段（COALESCE(cp.available_points, m.points, 0)），不再裸读 m.points", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total: 1, monthNew: 0, active30d: 0, wholesaleCount: 0, retailCount: 1, balanceSum: 0 }) // stats
      .mockResolvedValueOnce({ total: 1 }); // totalRow
    mocks.queryWithTenant.mockResolvedValueOnce([
      { id: 1, name: "张三", nickname: null, mobile: "13800000000", points: 88, totalConsume: 0 },
    ]);
    const result = await listMemberManage("t1", 1, 20, "");
    expect(result.records[0].points).toBe(88);
    const listSql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(listSql).toContain(`${MEMBER_POINTS_TRUTH_AVAILABLE_SQL} AS points`);
    expect(listSql).toContain("LEFT JOIN t_customer_points cp ON cp.customer_id = m.id AND cp.tenant_id = m.tenant_id");
    expect(listSql).not.toContain("levelName, m.points"); // 不再裸读遗留列（m.points 仅出现在 COALESCE 回退片段内）
    expect(listSql).toContain("m.tenant_id = ?");
  });

  it("getMemberOrders：分页返回会员订单", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ total: 1 }]) // 总数（数组）
      .mockResolvedValueOnce([{ billNo: "DD001", receivableAmount: 100 }]); // 行
    const result = await getMemberOrders("t1", 1, 1, 20);
    expect(result.total).toBe(1);
    expect(result.records[0].billNo).toBe("DD001");
  });
});
