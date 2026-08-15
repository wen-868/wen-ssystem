import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import { getLifecycleStages, getLifecycleTrend, getLifecycleDetail } from "../../../services/admin/customer-lifecycle.service";

describe("admin/customer-lifecycle.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("getLifecycleStages：返回阶段客户数统计", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      { stage: "ACTIVE", customerCount: 10 },
      { stage: "DORMANT", customerCount: 3 },
    ]);
    const result = await getLifecycleStages("t1");
    expect(result).toHaveLength(2);
    expect(result[0].stage).toBe("ACTIVE");
  });

  it("getLifecycleTrend：返回近 N 月转化趋势", async () => {
    mocks.queryWithTenant.mockResolvedValue([]); // 每月一次查询，共 3 次
    const result = await getLifecycleTrend("t1", 3);
    expect(result).toHaveLength(3);
    expect(result[0].PROSPECT).toBe(0);
    expect(result[0].month).toBeTruthy();
  });

  it("getLifecycleDetail：分页阶段明细", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ customerId: 1, customerName: "张三", stage: "ACTIVE" }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const result = await getLifecycleDetail({ stage: "ACTIVE", page: 1, pageSize: 20, tenantId: "t1" });
    expect(result.total).toBe(1);
    expect(result.records[0].customerName).toBe("张三");
  });
});
