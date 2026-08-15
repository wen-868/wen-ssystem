import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import { list, create, update, remove } from "../../../services/admin/brand.service";

describe("admin/brand.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("list：品牌列表（支持关键词）", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, name: "茅台" }]);
    const result = await list({ keyword: "茅", tenantId: "t1" });
    expect(result[0].name).toBe("茅台");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("name LIKE ?"),
      ["t1", "%茅%"],
      "t1"
    );
  });

  it("create：创建品牌", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ insertId: 3 });
    const result = await create({ name: "五粮液" }, "t1");
    expect(result.id).toBe(3);
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO t_brand"),
      expect.arrayContaining(["五粮液", "t1"]),
      "t1"
    );
  });

  it("update：更新品牌", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 3 });
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    await update(3, { name: "新品牌名" }, "t1");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_brand"),
      expect.arrayContaining(["新品牌名", 3, "t1"]),
      "t1"
    );
  });

  it("remove：删除品牌", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 3 });
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    await remove(3, "t1");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM t_brand"),
      [3, "t1"],
      "t1"
    );
  });
});
