import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.query,
  queryOneWithTenant: mocks.queryOne,
  query: mocks.query,
}));

import { setPrimary, getById } from "../../../services/admin/supplier-contact.service";

describe("supplier-contact setPrimary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("设置主联系人：先清除同供应商其他主标识，再设置当前为主", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ id: 5, supplier_id: 9, name: "张三", is_primary: 0, tenant_id: "t1" })
      .mockResolvedValueOnce({ id: 5, supplier_id: 9, name: "张三", is_primary: 1, tenant_id: "t1" });
    mocks.query.mockResolvedValue([]);

    const result = await setPrimary(5, "t1");

    expect(result?.is_primary).toBe(1);
    // 第一次 queryOne：查联系人；第二次：回查主标识
    expect(mocks.query).toHaveBeenCalledTimes(2);
    const clearSql = String(mocks.query.mock.calls[0][0]);
    const setSql = String(mocks.query.mock.calls[1][0]);
    expect(clearSql).toContain("UPDATE t_supplier_contact SET is_primary = 0");
    expect(clearSql).toContain("supplier_id = ?");
    expect(setSql).toContain("UPDATE t_supplier_contact SET is_primary = 1");
    expect(setSql).toContain("id = ?");
  });

  it("联系人不存在时抛 404", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(setPrimary(999, "t1")).rejects.toThrow("联系人不存在");
  });
});
