import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import { list, getDetail, confirm } from "../../../services/admin/customer-statement.service";

describe("admin/customer-statement.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("list：分页对账单列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ statement_no: "DZ001", amount: 100 }]);
    const result = await list({ page: 1, pageSize: 20, tenantId: "t1" });
    expect(result).toHaveLength(1);
    expect(result[0].statement_no).toBe("DZ001");
  });

  it("getDetail：返回对账单详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ statement_no: "DZ001", status: "DRAFT" });
    const detail = await getDetail("DZ001", "t1");
    expect(detail?.statement_no).toBe("DZ001");
  });

  it("confirm：草稿对账单确认", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, status: "DRAFT" });
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    const result = await confirm("DZ001", "t1", 1, "管理员");
    expect(result.statement_no).toBe("DZ001");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'CONFIRMED'"),
      ["DZ001", "t1"],
      "t1"
    );
  });
});
