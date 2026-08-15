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

import { detectDuplicates, getCustomerRelations } from "../../../services/admin/customer-merge.service";

describe("admin/customer-merge.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("detectDuplicates：按手机号检测重复客户", async () => {
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ mobile: "13800000000", count: 2, customer_ids: "1,2", customer_names: "张三,张三" }]) // 手机号重复统计
      .mockResolvedValueOnce([{ id: 1, name: "张三", mobile: "13800000000" }, { id: 2, name: "张三", mobile: "13800000000" }]); // 明细
    const result = await detectDuplicates("t1", "mobile");
    expect(result.total).toBe(1);
    expect(result.duplicates[0].type).toBe("mobile");
    expect(result.duplicates[0].customers).toHaveLength(2);
  });

  it("detectDuplicates：无重复返回空", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    const result = await detectDuplicates("t1", "mobile");
    expect(result.total).toBe(0);
    expect(result.duplicates).toHaveLength(0);
  });

  it("getCustomerRelations：返回客户关联数据", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, name: "张三", mobile: "13800000000" });
    mocks.queryWithTenant.mockResolvedValueOnce([]); // 各关系表
    const result = await getCustomerRelations("t1", 1);
    expect(result).not.toBeNull();
  });
});
