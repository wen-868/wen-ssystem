import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import { listReceivables, getDailySales } from "../../../services/store/receivable.service";

describe("store/receivable.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("listReceivables：分页应收列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ billNo: "XS001", receivableAmount: 100 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const result = await listReceivables({ page: 1, pageSize: 20, tenantId: "t1" });
    expect(result.total).toBe(1);
    expect(result.records[0].billNo).toBe("XS001");
  });

  it("getDailySales：返回当日销售汇总", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      { date: "2026-08-15", count: 3, amount: 500 },
      { date: "2026-08-14", count: 2, amount: 300 },
    ]);
    const result = await getDailySales(1, "t1");
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2026-08-14"); // reverse 后最早在前
  });
});
