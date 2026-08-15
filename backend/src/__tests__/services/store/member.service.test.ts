import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import { getMemberDetail, getMemberPoints, getMemberOrders } from "../../../services/store/member.service";

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

  it("getMemberPoints：返回积分账户", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ points: 100, total_points: 500 });
    const points = await getMemberPoints("t1", 1);
    expect(points).not.toBeNull();
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
