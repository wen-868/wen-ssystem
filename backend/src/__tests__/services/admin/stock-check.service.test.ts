import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import { createCheck, listChecks, getStatistics } from "../../../services/admin/stock-check.service";

describe("admin/stock-check.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.makeBizNo.mockReturnValue("PD20260815001");
  });

  it("createCheck：创建盘点单（DRAFT）", async () => {
    const conn = { execute: vi.fn() };
    conn.execute.mockResolvedValueOnce([{ insertId: 5 }]);
    mocks.transaction.mockImplementation(async (fn: any) => fn(conn));

    const result = await createCheck({ storeId: 1, remark: "月度盘点", tenantId: "t1" });
    expect(result.checkId).toBe(5);
    expect(result.checkNo).toBe("PD20260815001");
    expect(conn.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO t_stock_check"),
      ["PD20260815001", 1, "月度盘点", "t1"]
    );
  });

  it("listChecks：分页盘点单列表", async () => {
    mocks.query.mockResolvedValueOnce([{ check_no: "PD001", store_name: "总仓" }]);
    mocks.queryOne.mockResolvedValueOnce({ total: 1 });
    const result = await listChecks({ page: 1, pageSize: 20, tenantId: "t1" });
    expect(result.total).toBe(1);
    expect(result.records[0].check_no).toBe("PD001");
  });

  it("getStatistics：返回盘点统计", async () => {
    mocks.query.mockResolvedValueOnce([{ status: "DRAFT", cnt: 2 }]);
    mocks.queryOne.mockResolvedValueOnce({ total: 3 });
    const stats = await getStatistics("t1");
    expect(stats).not.toBeNull();
  });
});
