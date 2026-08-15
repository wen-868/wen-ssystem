import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

import { listVisits, getVisitDetail, getVisitStatistics } from "../../../services/admin/customer-visit.service";

describe("admin/customer-visit.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("listVisits：分页客户拜访列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ visit_no: "BF001", customer_name: "张三" }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const result = await listVisits("t1", { page: 1, pageSize: 20 });
    expect(result.total).toBe(1);
    expect(result.records[0].visit_no).toBe("BF001");
  });

  it("getVisitDetail：返回拜访详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ visit_no: "BF001", visit_type: "FIELD" });
    mocks.queryWithTenant.mockResolvedValueOnce([]); // 拜访记录
    const detail = await getVisitDetail("t1", "BF001");
    expect(detail?.visit_no).toBe("BF001");
  });

  it("getVisitStatistics：返回拜访统计", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 5 });
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ visitType: "FIELD", count: 3 }]) // byType
      .mockResolvedValueOnce([]) // byPurpose
      .mockResolvedValueOnce([]); // byStatus
    const result = await getVisitStatistics("t1", null, "2026-08-01", "2026-08-31");
    expect(result.totalVisits).toBe(5);
    expect(result.byType).toEqual({ FIELD: 3 });
  });
});
